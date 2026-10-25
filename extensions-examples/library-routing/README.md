# Library-routing extensions

**Status: Runnable in API v1.**

Library-routing extensions use normalized provider metadata to classify a matched show or movie, add a badge, expose host-rendered destination settings, and select an alternate base folder. Core filename templates, preview, collision handling, execution, logging, and undo remain in control.

Good uses include documentaries, concerts, stand-up, sport, children’s media, foreign-language media, home videos, and dedicated 4K/HDR/remux libraries. Only metadata fields supported by the current manifest may be used.

The [`documentary-libraries`](documentary-libraries/) example routes TMDB documentary genre `99` into separate show and movie folders.
