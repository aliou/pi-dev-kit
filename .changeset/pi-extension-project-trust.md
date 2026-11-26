---
"@aliou/pi-dev-kit": patch
---

Teach the pi-extension skill and update command to load project config only after Pi trusts the project: call `bindProjectConfig()` after `configLoader.load()` in every entry point and read config when handlers run.
