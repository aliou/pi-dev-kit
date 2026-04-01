---
"@aliou/pi-dev-kit": minor
---

Overhaul tool rendering guidelines and update extension tools to match.

Skill updates:
- tools.md: throw errors, ToolCallHeader/ToolBody/ToolFooter from pi-utils-ui, stable isPartial, conditional footer, truncateHead + temp file, promptSnippet/promptGuidelines, multi-action tool pattern
- structure.md: core/lib pattern, action modules, config migrations, settings command, auth wizard
- additional-apis.md: two-tier guidance (per-tool metadata vs system prompt hooks)
- testing.md: unit testing core logic, testable execute with DI, handler pattern, Pi stub
- SKILL.md: new critical rules, updated checklist, standalone repo references

Tool updates:
- All tools: add promptSnippet/promptGuidelines, throw errors, simplify details
- changelog-tool: conditional footer, keyHint for expand
- docs-tool: ToolBody with showCollapsed, conditional footer
- package-manager-tool: throw on missing package.json
- version-tool: simplified details
