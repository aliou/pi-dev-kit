---
"@aliou/pi-dev-kit": patch
---

Update the pi-extension skill and update command for pi 1.6.0 components: lines returned by `render()` are read-only cached arrays that must be copied before modification. Teach `truncateToWidth` from `@aliou/pi-utils-ui` instead of pi-tui's.
