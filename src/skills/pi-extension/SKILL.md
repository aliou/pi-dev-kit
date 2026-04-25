---
name: pi-extension
description: Create, update, and publish Pi extensions. Use when working on extensions in this repository.
---

# Pi Extension Development

Guide for creating and maintaining Pi extensions. Read the relevant reference files before implementing.

## Key Imports

Pi injects these packages via jiti at runtime. Extensions do not need to install them — they are available as peer dependencies:

- `@mariozechner/pi-coding-agent` — core types, utilities, and extension APIs
- `@mariozechner/pi-tui` — TUI components
- `@mariozechner/pi-ai` — AI utilities (`StringEnum`, etc.)
- `typebox` — TypeBox 1.x schema definitions for tool parameters and related types. Do not use `@sinclair/typebox` in new code.

```typescript
// Tool UI components (from @aliou/pi-utils-ui)
import { ToolCallHeader, ToolBody, ToolFooter } from "@aliou/pi-utils-ui";

// Core types
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";

// Rendering utilities
import { getMarkdownTheme, keyHint, truncateHead, formatSize } from "@mariozechner/pi-coding-agent";

// TUI components
import { Container, Markdown, Text } from "@mariozechner/pi-tui";
```

## Workflow

### Creating a New Extension

1. Read `references/structure.md` for the project layout and package.json template.
2. Decide what the extension provides and create one feature entry point per directory:
   - **Tools** (LLM-callable): `src/tools/index.ts`; read `references/tools.md`.
   - **Commands** (user-invoked): `src/commands/index.ts`; read `references/commands.md`.
   - **Providers** (LLM backends): `src/providers/index.ts`; read `references/providers.md`.
   - **Hooks** (event handlers): `src/hooks/index.ts`; read `references/hooks.md`. Includes both `tool_call` blocking hooks and spawn hooks for transparent command rewriting via `createBashTool`.
3. Add each feature entry point to `package.json` `pi.extensions`. Each entry point exports a default function that receives `ExtensionAPI` and calls `pi.registerTool`, `pi.registerCommand`, `pi.registerProvider`, or `pi.on` directly.
4. Read `references/modes.md` for mode-awareness guidelines. Every extension must handle Interactive, RPC, and Print modes.
5. If the extension displays rich UI: Read `references/components.md` for TUI components and `references/messages.md` for message display patterns.
6. If the extension tracks state: Read `references/state.md`.
7. For less common APIs: Read `references/additional-apis.md`.
8. If the extension has user-configurable settings: Use `registerSettingsCommand` from `@aliou/pi-utils-settings`. Read `references/structure.md` for settings command and auth wizard patterns.
9. If the extension adds a tool that competes with a natural bash fallback: use `promptSnippet` and `promptGuidelines` on the tool definition for simple guidance. Write `promptGuidelines` as standalone bullets that name the exact tool, because pi injects them verbatim into the shared global `Guidelines` section. Use system prompt hooks only for complex cross-tool orchestration. Read the **Guidance** section in `references/additional-apis.md`.
10. Before publishing: Read `references/publish.md` and `references/documentation.md`.

### Modifying an Existing Extension

1. Read the extension's `index.ts` to understand its structure.
2. Read the relevant reference file for the area you are modifying.
3. Check `references/modes.md` if adding any UI interaction.
4. Run type checking after changes.

## Reference Files

| File | Content |
|---|---|
| `references/structure.md` | Project layout, package.json, tsconfig, biome.json, config.ts, entry point patterns (including acceptable exceptions), API key pattern, imports |
| `references/tools.md` | Tool registration, execute signature, parameters, `prepareArguments`, path normalization, file mutation queueing, streaming, rendering, naming, renderCall/renderResult UI guidelines |
| `references/hooks.md` | Events, blocking/cancelling, input transformation, system prompt modification, bash spawn hooks (command rewriting) |
| `references/commands.md` | Command registration, three-tier pattern, component extraction |
| `references/components.md` | TUI components (pi-tui + pi-coding-agent), custom(), theme styling, keyboard handling |
| `references/providers.md` | Current `pi.registerProvider(name, config)` API, model definition, provider override/registration patterns, API key gating |
| `references/modes.md` | Mode behavior matrix, ctx.hasUI, dialog vs fire-and-forget, three-tier pattern |
| `references/messages.md` | sendMessage, registerMessageRenderer, notify, when to use each |
| `references/state.md` | appendEntry, state reconstruction, appendEntry vs sendMessage |
| `references/additional-apis.md` | Shortcuts, flags, exec, sendUserMessage, session name, labels, model control, EventBus, theme, UI customization, system prompt guidance injection |
| `references/publish.md` | npm publishing, changesets (manual file format + CI automation), GitHub Actions publish workflow, first-time setup, NPM_TOKEN, pre-publish checklist |
| `references/testing.md` | Local development, type checking, manual testing, debugging |
| `references/documentation.md` | README template, what to document, changelog |

## Reference Extensions

When implementing, look at these existing extensions for patterns:

**Standalone repos (recommended structure):**
- `pi-linkup` (`/Users/alioudiallo/code/src/pi.dev/pi-linkup/`): Tools wrapping a third-party API. Has tools with `promptSnippet`/`promptGuidelines`, custom rendering with `ToolCallHeader`/`ToolBody`/`ToolFooter`, output truncation with temp files, API key gating. Moved from system-prompt hooks to per-tool metadata.
- `pi-synthetic` (`/Users/alioudiallo/code/src/pi.dev/pi-synthetic/`): Provider + tools. Has a provider with models, a command with `custom()` component, API key gating.
- `pi-processes` (`/Users/alioudiallo/code/src/pi.dev/pi-processes/`): Multi-action tool with `promptSnippet`/`promptGuidelines` plus system prompt guidance hook for complex multi-tool orchestration, core `ProcessManager` class with unit tests, `ToolBody` with `showCollapsed` fields, conditional footers.
- `pi-linear` (`/Users/alioudiallo/code/src/pi.dev/pi-linear/`): Multi-action tool with action modules, auth wizard using `Wizard` from `@aliou/pi-utils-settings`, settings command with `registerSettingsCommand`, config migrations, `ToolBody`/`ToolFooter` rendering, system prompt guidance for cross-tool orchestration.
- `pi-obsidian` (`/Users/alioudiallo/code/src/pi.dev/pi-obsidian/`): Tools wrapping a CLI. Has a separate `obsidian-vault-core` package for domain logic. Uses `pi.exec()` for shell commands, `ToolCallHeader`/`ToolFooter` rendering, throws errors.

## Critical Rules

1. **Execute parameter order**: `(toolCallId, params, signal, onUpdate, ctx)`. Signal before onUpdate.
2. **Always use `onUpdate?.()`**: Optional chaining. The parameter can be `undefined`.
3. **No `.js` in imports**: Use bare module paths (`./tools/my-tool`, not `./tools/my-tool.js`).
4. **Mode awareness**: Every `ctx.ui.custom()` call needs an RPC fallback (use `select`/`confirm`/`notify` -- they work in RPC). Do not use `done(undefined)` for normal interactive close paths when you detect fallback with `result === undefined`; use explicit sentinels (`null`, `"closed"`, boolean). Every `tool_call` hook with dialogs needs a `ctx.hasUI` check.
5. **API key gating**: Check before registering tools that require the key. Providers handle missing keys internally via their `models()` function.
6. **Tool naming**: Prefix with API name for third-party integrations (`linkup_web_search`). No prefix for internal tools (`get_current_time`).
7. **Tool rendering uses `ToolCallHeader`**: First line `[Tool Name]: [Action] [Main arg] [Option args]`, long args on follow-up lines. Use display names, not raw tool IDs.
8. **Deterministic call rendering**: Build `renderCall` with a stable extraction order (action → main arg → option args → long args), process-style. Same input should produce same header layout.
9. **Long args placement**: Put long prompt/task/question/context strings on following lines. Keep first line scannable.
10. **Result layout**: In `renderResult(result, options, theme)`, handle `isPartial` first with a stable tool-scoped message. Detect errors by checking for missing expected fields in `details` (framework sets `details: {}` on throw). Use `ToolBody` from `@aliou/pi-utils-ui` with `showCollapsed` fields. Use `ToolFooter` conditionally (omit when empty). Use `Container`/`Markdown` for rich content.
11. **Tool definitions use `defineTool()`**: Define standalone tools with `defineTool({...})` from `@mariozechner/pi-coding-agent` so `execute`, `renderCall`, and `renderResult` infer typed params from the `parameters` field without casts or explicit generic arguments. Also define `type MyToolParams = Static<typeof parameters>` at the top of each tool file and use it everywhere.
12. **Tool metadata**: Every tool must have `label` (required). Add `promptSnippet` for system prompt tool listing. Add `promptGuidelines` for usage instructions, but write them as standalone global bullets that name the exact tool. These replace system-prompt hooks for simple tools.
13. **Output truncation**: For tools returning large text, use `truncateHead()` from `@mariozechner/pi-coding-agent`. Write full content to temp file. Append footer with line/byte counts and temp file path.
14. **Core/lib pattern**: Extract domain logic into modules (`client.ts`, `manager.ts`) that don't import from Pi. Tools are thin wrappers. Core modules are unit-testable with vitest.
15. **Humanize messages**: Show display names first, IDs in dim/parens. `"Started \"backend\" (proc_42)"` not `"Started proc_42"`.
16. **peerDependencies**: Pi injects `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@mariozechner/pi-ai`, and `typebox` via jiti at runtime. Any of these that your extension imports must be listed in `peerDependencies` with `optional: true` in `peerDependenciesMeta`. Without `optional: true`, npm 7+ auto-installs peers, adding hundreds of packages on every install even though Pi already provides them. Keep them in `devDependencies` too for local type checking — `pnpm install` installs peers, so development is unaffected. Use `>=CURRENT_VERSION` range, not `*`. Pi 0.69+ uses `typebox` 1.x; do not import from `@sinclair/typebox`.
17. **Check existing components**: Before creating a new TUI component, check if `pi-tui` or `pi-coding-agent` already exports one that fits.
18. **Forward abort signals**: Always pass `signal` through to `fetch()`, `pi.exec()`, and API client methods. A tool that ignores its signal prevents cancellation from reaching the underlying operation. Never prefix with `_signal` unless the tool truly has no async work to cancel.
19. **Never use Node child_process APIs**: Do not use `child_process.exec`, `execSync`, `spawn`, `spawnSync`, `execFile`, or `execFileSync` to run binaries or shell scripts. Always use `pi.exec()`. `pi.exec` handles CWD, signal propagation, and output capture consistently. The only exception is if you need a long-lived streaming process with stdin/stdout piping that `pi.exec` cannot support — document the reason in code comments.
20. **Never use `homedir()` for pi paths**: Use the SDK helpers from `@mariozechner/pi-coding-agent` instead. They respect the `PI_CODING_AGENT_DIR` env var which is used for testing and custom setups. Key functions: `getAgentDir()`, `getSettingsPath()`, `getSessionsDir()`, `getPromptsDir()`, `getToolsDir()`, `getCustomThemesDir()`, `getModelsPath()`, `getAuthPath()`, `getBinDir()`, `getDebugLogPath()`. All exported from the main package entry point.
21. **Config uses the interface pattern**: `config.ts` defines two TypeScript interfaces (`RawConfig` with all fields optional, `ResolvedConfig` with all fields required) and a `ConfigLoader<Raw, Resolved>` instance. Do not use TypeBox schemas for config types. For config migrations, use `ConfigLoader` `migrations` option. For settings UI, use `registerSettingsCommand` from `@aliou/pi-utils-settings`.
22. **Entry point deviations must be documented**: The standard entry point pattern for each feature entry is load config → check `enabled` → register with `pi`. Deviations (no config, API-key-first ordering, no `enabled` toggle) are acceptable when justified, but must be noted in `AGENTS.md`.
23. **Session replacement uses `withSession`**: After `ctx.newSession()`, `ctx.fork()`, or `ctx.switchSession()`, captured old `pi`, command `ctx`, and `ctx.sessionManager` are stale and may throw. Put post-switch work in `withSession` and use only that fresh callback context.

## Checklist

Before considering an extension complete:

- [ ] Each feature entry point listed in `package.json` `pi.extensions` has the correct default export signature.
- [ ] Tools, commands, providers, and hooks are separate feature entry directories; no root `src/index.ts` fan-out registrar.
- [ ] TUI components are colocated with the feature that uses them, or in `src/components/` only when genuinely shared; they are not listed in `pi.extensions`.
- [ ] Every standalone tool is wrapped in `defineTool()` so typed params flow into `execute`, `renderCall`, and `renderResult` without casts.
- [ ] All tools have correct execute parameter order.
- [ ] All `onUpdate` calls use optional chaining.
- [ ] No `.js` file extensions in imports.
- [ ] `renderCall` uses `ToolCallHeader` with consistent first-line pattern (tool, action if any, main arg, options).
- [ ] `renderCall` arg extraction is deterministic (action → main arg → option args → long args).
- [ ] Long call arguments are moved to follow-up lines, not crammed into first line.
- [ ] `renderResult` handles `isPartial` first with a stable tool-scoped message.
- [ ] `renderResult` detects errors by checking for missing expected fields in `details` (framework sets `details: {}` on throw).
- [ ] `renderResult` uses `ToolBody` with `showCollapsed` fields.
- [ ] `renderResult` uses `ToolFooter` conditionally (omits when empty).
- [ ] Every tool has `label` field.
- [ ] Tools have `promptSnippet` and/or `promptGuidelines` when appropriate, and `promptGuidelines` bullets name the exact tool instead of saying `this tool`.
- [ ] Large output tools use `truncateHead()` + temp file pattern.
- [ ] Domain logic is extracted to testable core modules.
- [ ] File-mutating custom tools use `withFileMutationQueue()` for the full read-modify-write window.
- [ ] Path-taking custom tools normalize a leading `@` before resolving paths.
- [ ] Tool overrides re-declare `promptSnippet`/`promptGuidelines` if they need inherited prompt behavior.
- [ ] `ctx.ui.custom()` calls have RPC fallback, and interactive close/cancel paths do not rely on `done(undefined)` when fallback detection uses `result === undefined`.
- [ ] `tool_call` hooks check `ctx.hasUI` before dialog methods.
- [ ] Fire-and-forget methods (notify, setStatus, etc.) are used without hasUI guards.
- [ ] If using custom message renderers: collapsed view is scannable, expanded view adds depth, and renderer has plain-text fallback when `details` is missing.
- [ ] `signal` is forwarded to all async operations (fetch, `pi.exec`, API clients). No unused `_signal`.
- [ ] Missing API keys produce a notification, not a crash.
- [ ] If in a monorepo: package doesn't depend on private workspace packages (run `pnpm run check:public-deps` if available).
- [ ] `pnpm typecheck` passes.
- [ ] No `child_process` imports -- uses `pi.exec()` for shell commands.
- [ ] No `homedir()` calls for pi paths -- uses SDK helpers (`getAgentDir()`, etc.).
- [ ] README documents tools, commands, env vars.
- [ ] `@mariozechner/pi-tui` (and any other Pi-provided package) is in `peerDependencies` with `optional: true` if imported at runtime, not just `devDependencies`.
- [ ] `prepare` script is `"[ -d .git ] && husky || true"`, not bare `"husky"`.
- [ ] `config.ts` uses `ConfigLoader<Raw, Resolved>` with TypeScript interfaces, not TypeBox schemas.
- [ ] If deviating from the standard feature entry pattern (load-config → check-enabled → register), the reason is documented in `AGENTS.md`.
- [ ] Settings use `registerSettingsCommand` from `@aliou/pi-utils-settings` when the extension has user-configurable settings.
- [ ] New code imports TypeBox from `typebox`, not `@sinclair/typebox`.
- [ ] Any session replacement code uses `withSession` for post-switch work and does not reuse stale session-bound objects.
