# Transformation example

**Status: Design example — Stage 6.**

Transformations request host-mediated remuxing, subtitle/font/artwork extraction, subtitle conversion, or thumbnail generation. The reference example will request an FFmpeg remux without transcoding.

The host selects an approved executable, builds arguments from structured fields, forbids arbitrary command strings, constrains input/output roots, enforces time and resource limits, previews outputs, and records recoverable operations. This capability is never granted by installation alone.
