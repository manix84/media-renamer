# Documentary libraries example

**Status: Runnable.**

This extension demonstrates the smallest complete library router:

1. Match provider genre ID `99`.
2. Display a **Documentary** badge.
3. Ask the user for documentary show and movie folders.
4. Add inherited Shows and Movies settings tabs.
5. Route matching media only while enabled.

Install this directory through **Preferences → Extensions**. The extension starts disabled and does nothing until the user enables it and chooses destination folders.

Nearby negative cases worth testing are a factual drama without genre `99`, animation, and a show with incomplete metadata. They must remain in the normal library.
