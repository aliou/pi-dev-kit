# @aliou/pi-extension-dev

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

- 6657016: Standardize extension-dev tool renderCall headers with the shared tool header pattern for consistent tool/action/argument readability.

## 0.4.0

### Minor Changes

- 3452b4e: pi_docs and pi_changelog tools now use the built-in expanded/collapsed toggle (Ctrl+O). Collapsed view shows compact summaries, expanded view shows full details. New pi_changelog_versions tool for listing available versions separately.

## 0.3.0

### Minor Changes

- 3f22ea6: Update tool return type docs to use `content` blocks instead of `output` string, add error handling section documenting throw-based error reporting.

## 0.2.1

### Patch Changes

- 82c1d39: Move pi-extension skill into extension-dev package, add tool delegation warning in skill docs, standardize peerDependencies to >=0.51.0.

## 0.2.0

### Minor Changes

- 4ac87a8: Add demo-setup skill and /setup-demo prompt for creating extension demo environments.

## 0.1.1

### Patch Changes

- dccbf2d: Add preview video to package.json for the pi package browser.

## 0.1.0

### Minor Changes

- 3324434: Initial release of @aliou/pi-extension-dev, replacing @aliou/pi-meta.

  Tools: pi_version, pi_changelog, pi_docs, detect_package_manager.
  Command: /extensions:update [VERSION] - update Pi extensions to installed or latest version.
