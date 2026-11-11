package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"time"
)

var encodedToken string
var tokenMask string

var allowedPaths = []*regexp.Regexp{
	regexp.MustCompile(`^/3/search/(tv|movie)$`),
	regexp.MustCompile(`^/3/find/(?:[0-9]+|tt[0-9]+)$`),
	regexp.MustCompile(`^/3/(?:tv|movie)/[0-9]+$`),
	regexp.MustCompile(`^/3/tv/[0-9]+/season/[0-9]+$`),
}

var allowedQueryKeys = map[string]bool{
	"append_to_response": true, "external_source": true, "first_air_date_year": true,
	"include_adult": true, "include_image_language": true, "query": true, "year": true,
}

func releaseToken() (string, error) {
	encoded, err := base64.StdEncoding.DecodeString(encodedToken)
	if err != nil {
		return "", errors.New("invalid embedded credential")
	}
	mask, err := base64.StdEncoding.DecodeString(tokenMask)
	if err != nil || len(encoded) == 0 || len(encoded) != len(mask) {
		return "", errors.New("invalid embedded credential")
	}
	plain := make([]byte, len(encoded))
	for index := range encoded {
		plain[index] = encoded[index] ^ mask[index]
	}
	return string(plain), nil
}

func approvedRequest(value string) (*url.URL, error) {
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || parsed.Fragment != "" {
		return nil, errors.New("invalid TMDB request")
	}
	allowed := false
	for _, pattern := range allowedPaths {
		if pattern.MatchString(parsed.Path) {
			allowed = true
			break
		}
	}
	if !allowed {
		return nil, errors.New("TMDB route is not allowed")
	}
	for key := range parsed.Query() {
		if !allowedQueryKeys[key] {
			return nil, errors.New("TMDB query parameter is not allowed")
		}
	}
	parsed.Scheme = "https"
	parsed.Host = "api.themoviedb.org"
	return parsed, nil
}

func run(argument string, output io.Writer) error {
	target, err := approvedRequest(argument)
	if err != nil {
		return err
	}
	token, err := releaseToken()
	if err != nil {
		return err
	}
	request, err := http.NewRequest(http.MethodGet, target.String(), nil)
	if err != nil {
		return errors.New("could not create TMDB request")
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 20 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return errors.New("TMDB request failed")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 20*1024*1024+1))
	if err != nil || len(body) > 20*1024*1024 || !json.Valid(body) {
		return errors.New("TMDB returned an invalid response")
	}
	return json.NewEncoder(output).Encode(struct {
		Status int             `json:"status"`
		Body   json.RawMessage `json:"body"`
	}{response.StatusCode, body})
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: tmdb-helper <approved-relative-url>")
		os.Exit(2)
	}
	if err := run(os.Args[1], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err.Error())
		os.Exit(1)
	}
}
