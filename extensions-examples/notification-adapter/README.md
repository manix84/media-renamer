# Notification adapter example

**Status: Design example — Stage 5.**

The reference adapter will send a completion summary to a user-approved Home Assistant webhook. Future adapters may cover email or chat services.

Network origins, event types, and disclosed fields require explicit approval. Secrets stay in host storage. Payload preview, redaction, timeouts, rate limits, and failure isolation are mandatory; notification failure never rolls back a successful rename.
