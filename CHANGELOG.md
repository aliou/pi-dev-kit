# @aliou/pi-dev-kit

## 0.6.4

### Patch Changes

- 4edd7ad: Update Pi peer/dev dependencies from 0.65.2 to 0.68.0

## 0.6.3

### Patch Changes

- 50d243e: Name tools explicitly in promptGuidelines so they make sense in the global system prompt Guidelines section

## 0.6.2

### Patch Changes

- 19d2632: Fix TypeBox imports in skill documentation and template example

  - Add `@sinclair/typebox` to peerDependencies/devDependencies in structure.md example
  - Fix template tools/index.ts to show correct separate imports for `defineTool` (from pi-coding-agent) and `Type`/`Static` (from @sinclair/typebox)
  - Add promptSnippet/promptGuidelines examples to template with proper tool naming

- f760c70: Align the `pi-extension` skill references with current pi-mono behavior.

  - clarify that `promptGuidelines` are injected verbatim into the shared global guidelines section
  - fix TypeBox import guidance to use `@sinclair/typebox`
  - update provider docs to the current `pi.registerProvider(name, config)` API
  - document `prepareArguments`, `withFileMutationQueue`, `@` path normalization, and prompt metadata override caveats

## 0.6.1

### Patch Changes

- c12edf9: Update Pi package peer/dev dependency versions to 0.65.2 and refresh shipped extension guidance for current session lifecycle and state reconstruction APIs.

## 0.6.0

### Minor Changes

- ff71e6f: Overhaul tool rendering guidelines and update extension tools to match.

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

## 0.5.0

### Minor Changes

- a214efa: Rename the package from `@aliou/pi-extension-dev` to `@aliou/pi-dev-kit`.

  The package continues on the same release line under the new name. Update installation docs and package metadata to match the rename.

## 0.4.6

### Patch Changes

- c56d491: Add error rendering pattern and `@aliou/pi-utils-ui` imports to pi-extension skill.

  - `references/tools.md`: new "Error rendering in renderResult" section with a complete divide tool example showing how to detect and display errors from thrown exceptions.
  - `SKILL.md`: added `@aliou/pi-utils-ui` imports (ToolCallHeader, ToolBody, ToolFooter), rendering utilities, Markdown component, and a checklist item for error rendering.

## 0.4.5

### Patch Changes

- 9d5ad7f: Expand and improve pi-extension and demo-setup skills with richer reference documentation.

  The `pi-extension` skill received significant updates across multiple reference files:

  - `tools.md` and `messages.md`: expanded with more complete API coverage
  - `components.md` and `modes.md`: clarified `ui.custom` RPC semantics and fallback patterns
  - `hooks.md`: fixed `before_agent_start` API docs and documented `ConfigLoader` persistence
  - `structure.md`: corrected patterns and documented module layout conventions
  - `additional-apis.md`: added guidance injection pattern for extensions
  - `publish.md`: expanded with CI workflow, first-time setup steps, and manual changeset format

  The `demo-setup` skill was updated to be generic across extension types and now includes the Northwind database as a base project option.

## 0.4.4

### Patch Changes

- da8ec83: mark pi SDK peer deps as optional to prevent koffi OOM in Gondolin VMs

## 0.4.3

### Patch Changes

- 828a195: Fix: include real source files

## 0.4.2

### Patch Changes

- 611c23a: Move to standalone repository

## 0.4.1

### Patch Changes

- 6657016: Standardize dev-kit tool renderCall headers with the shared tool header pattern for consistent tool/action/argument readability.

## 0.4.0

### Minor Changes

- 3452b4e: pi_docs and pi_changelog tools now use the built-in expanded/collapsed toggle (Ctrl+O). Collapsed view shows compact summaries, expanded view shows full details. New pi_changelog_versions tool for listing available versions separately.

## 0.3.0

### Minor Changes

- 3f22ea6: Update tool return type docs to use `content` blocks instead of `output` string, add error handling section documenting throw-based error reporting.

## 0.2.1

### Patch Changes

- 82c1d39: Move pi-extension skill into the dev kit package, add tool delegation warning in skill docs, standardize peerDependencies to >=0.51.0.

## 0.2.0

### Minor Changes

- 4ac87a8: Add demo-setup skill and /setup-demo prompt for creating extension demo environments.

## 0.1.1

### Patch Changes

- dccbf2d: Add preview video to package.json for the pi package browser.

## 0.1.0

### Minor Changes

- 3324434: Initial release of @aliou/pi-dev-kit, replacing @aliou/pi-meta.

  Tools: pi_version, pi_changelog, pi_docs, detect_package_manager.
  Command: /extensions:update [VERSION] - update Pi extensions to installed or latest version.
