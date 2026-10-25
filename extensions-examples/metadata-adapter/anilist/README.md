# AniList metadata adapter

**Status: Contract example, not installable.**

[`manifest.example.json`](manifest.example.json) demonstrates the Stage 2 declarative provider contract without placing the package in Media Renamer's discovered extension directories.

The example requests only `network.metadata` access to the exact origin `https://graphql.anilist.co`. Its `anime.search` operation accepts one required, bounded string and supplies a fixed GraphQL document. The host—not extension code—constructs the JSON request, rejects undeclared inputs, applies the capability grant, and passes the request through the restricted network broker.

This package intentionally cannot run yet. Before live activation, the host must:

1. pin the public DNS result used by the connection;
2. map and validate the provider response into Media Renamer's normalized metadata model;
3. connect opaque credential references where a provider requires authentication;
4. add cache and provider-rate-limit policy; and
5. expose review UI that clearly names the contributing provider.

No JavaScript, headers, credentials, filesystem paths, or arbitrary URLs are supplied by this example.
