---
"@aliou/pi-dev-kit": patch
---

Update the pi-extension skill and update command guidance for pi changes since 1.0.0: tool arguments are validated as JSON Schema so TypeBox-only features (`Type.Refine()`, `Type.BigInt()`, codecs, `Format.Set()`) no longer apply and `Type.Optional(StringEnum(...))` loses optionality in `Static` inference on pi >= 1.5.0; `before_agent_start` also fires for `sendMessage`-triggered runs and the event is a union on `messageType`; `pi.exec()` gains `maxBuffer` and `result.truncated`; `sendUserMessage` requires `deliverAs` while the session is busy; document `pi.registerToolRenderer()`, `durationMs` in the tool render context, and the package changelog shown after updates.
