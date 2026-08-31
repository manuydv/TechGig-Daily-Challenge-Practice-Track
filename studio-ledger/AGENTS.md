# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

Pinned to SDK 54, two behind the newest published to npm (57) — this repo
was downgraded twice (57 -> 56 -> 54) chasing what the installed Expo Go
app actually supports. Confirmed via the Expo Go app itself: open it ->
Settings tab -> "App Info" section -> "Supported SDK" shows the exact
number for that install. Don't trust "update Expo Go and it'll work" alone;
that field is the ground truth. If you're bumping this later, check that
field on an actual device first — a too-new SDK produces "Project is
incompatible with this version of Expo Go" on device, and reinstalling
Expo Go from the App Store does not guarantee it supports the newest SDK
published to npm (there's a lag, and it can be more than one SDK behind).
