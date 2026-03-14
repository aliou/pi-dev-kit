---
"@aliou/pi-extension-dev": patch
---

Expand and improve pi-extension and demo-setup skills with richer reference documentation.

The `pi-extension` skill received significant updates across multiple reference files:
- `tools.md` and `messages.md`: expanded with more complete API coverage
- `components.md` and `modes.md`: clarified `ui.custom` RPC semantics and fallback patterns
- `hooks.md`: fixed `before_agent_start` API docs and documented `ConfigLoader` persistence
- `structure.md`: corrected patterns and documented module layout conventions
- `additional-apis.md`: added guidance injection pattern for extensions
- `publish.md`: expanded with CI workflow, first-time setup steps, and manual changeset format

The `demo-setup` skill was updated to be generic across extension types and now includes the Northwind database as a base project option.
