---
"@aliou/pi-dev-kit": patch
---

Update the pi-extension skill and update command guidance for pi 1.5.0: document the `blocked` option for inline `ctx.ui.custom()` components that wait for an answer, and teach the injected `keyHint()`/`keyText()` from render contexts instead of importing them, which can resolve to a copy that does not see pi's keybindings.
