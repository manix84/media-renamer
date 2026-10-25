# Event subscriber example

**Status: Design example — Stage 5.**

Event subscribers receive explicitly selected lifecycle events such as import, match, preview-ready, rename-completed, rename-failed, and undo-completed. Payloads use operation IDs and bounded summaries rather than raw logs or media contents.

Subscriptions are individually permissioned and audited. Delivery has timeouts and cannot delay or alter a completed filesystem transaction.
