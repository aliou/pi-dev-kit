---
"@aliou/pi-dev-kit": patch
---

Fix TypeBox imports in skill documentation and template example

- Add `@sinclair/typebox` to peerDependencies/devDependencies in structure.md example
- Fix template tools/index.ts to show correct separate imports for `defineTool` (from pi-coding-agent) and `Type`/`Static` (from @sinclair/typebox)
- Add promptSnippet/promptGuidelines examples to template with proper tool naming
