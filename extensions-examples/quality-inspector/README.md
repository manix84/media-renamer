# Inspector and quality-policy example

**Status: Design example — Stage 4.**

The reference quality inspector will flag interlaced video, unexpected codecs, missing preferred audio, suspicious resolution/bitrate combinations, and damaged-stream probe failures.

It receives a read-only `media.inspect-summary` containing normalized probe facts—not media contents or arbitrary paths. Rules return bounded findings with severity and evidence. They cannot launch probes, read files, or mutate a batch.
