---
"@aliou/pi-dev-kit": minor
---

Update pi-extension skill to document the multi-extension pattern (src/ Pi-agnostic core, extensions/ for Pi-facing entry points, event bus, nested config split, migration pattern). Preserve existing extension structures when modifying -- don't migrate unless the user asks.
