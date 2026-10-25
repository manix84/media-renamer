# Metadata adapter example

**Status: Design example — Stage 2.**

This type will add provider search, details, artwork, and cross-reference lookups. The reference example will use AniList through the host-mediated `network.metadata` capability.

The capability declaration, explicit grant UI, and internal bounded JSON broker now exist. The example remains a design example until the production transport pins validated DNS resolution and the host exposes a provider-specific request contract. Extensions will receive structured results, not raw credentials or unrestricted network access.

The extension will declare allowed HTTPS origins, request/response schemas, cache policy, rate limits, and required secrets. Credentials stay in host secure storage and are never included in manifests, logs, renderer state, or extension messages. Redirects and response sizes are bounded by the host.
