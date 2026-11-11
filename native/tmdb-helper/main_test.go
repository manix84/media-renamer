package main

import "testing"

func TestApprovedRoutes(t *testing.T) {
	valid := []string{"/3/search/tv?query=Example&include_adult=false", "/3/find/123?external_source=tvdb_id", "/3/find/tt123?external_source=imdb_id", "/3/tv/42?append_to_response=external_ids%2Cimages", "/3/movie/9", "/3/tv/42/season/0"}
	for _, value := range valid {
		if _, err := approvedRequest(value); err != nil {
			t.Errorf("expected %s to be allowed: %v", value, err)
		}
	}
}

func TestRejectsUnapprovedDestinationsAndParameters(t *testing.T) {
	invalid := []string{"https://example.com/3/tv/42", "//example.com/3/tv/42", "/4/tv/42", "/3/person/42", "/3/tv/not-a-number", "/3/tv/42?redirect=https://example.com", "/3/tv/42#fragment"}
	for _, value := range invalid {
		if _, err := approvedRequest(value); err == nil {
			t.Errorf("expected %s to be rejected", value)
		}
	}
}

func TestReconstructsSplitCredential(t *testing.T) {
	encodedToken = "FQcQEA=="
	tokenMask = "YWJjZA=="
	value, err := releaseToken()
	if err != nil || value != "test" {
		t.Fatalf("unexpected credential result %q: %v", value, err)
	}
}
