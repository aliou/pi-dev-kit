---
"@aliou/pi-dev-kit": patch
---

Align the `pi-extension` skill references with current pi-mono behavior.

- clarify that `promptGuidelines` are injected verbatim into the shared global guidelines section
- fix TypeBox import guidance to use `@sinclair/typebox`
- update provider docs to the current `pi.registerProvider(name, config)` API
- document `prepareArguments`, `withFileMutationQueue`, `@` path normalization, and prompt metadata override caveats
