---
name: pi-extension
description: Create, update, and publish Pi extensions. Use when working on Pi extension packages, custom tools, commands, providers, hooks, TUI components, skills, prompts, or themes.
---

# Pi Extension Development

Use this skill to build and maintain Pi packages. Read the reference file for the area you are changing before editing.

## Package Namespace

Pi core packages are moving from `@mariozechner/*` to `@earendil-works/*`.

- Prefer `@earendil-works/*` for new or migrated code once the target package exists on npm.
- Keep legacy `@mariozechner/*` imports when the target version is not published under the new namespace yet.
- Do not mix namespaces inside one package unless you are deliberately supporting a staged migration.

Core packages provided by Pi at runtime:

- `@earendil-works/pi-coding-agent` — extension API, types, tools, utilities.
- `@earendil-works/pi-tui` — TUI components.
- `@earendil-works/pi-ai` — AI utilities, model types, and transcript helpers.

Tool parameter schemas use `@earendil-works/pi-schema`, which Pi does not provide to extensions: list it in `dependencies`.

## Standard Imports

```typescript
import { ToolBody, ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type { AgentToolResult, ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import {
  defineTool,
  formatSize,
  getMarkdownTheme,
  truncateHead,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { compile, obj, oneOf, opt, type Static, str } from "@earendil-works/pi-schema";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
```

If using the legacy namespace, replace `@earendil-works/*` with the matching `@mariozechner/*` package.

## Workflow

### Creating a new extension

1. Read `references/structure.md` for layout, package metadata, config, event bus, and entry-point rules.
2. Create `src/config/` with `types.ts`, `defaults.ts`, `loader.ts`, and `migration/`.
3. Create `src/events.ts` with event bus constants and payload types.
4. Create the main extension under `extensions/my-domain/` (config, settings, feature discovery).
5. Create sub-extensions under `extensions/` for each feature (tools, providers, etc.).
6. Read feature-specific references:
   - Tools: read `references/tools.md`.
   - Commands: read `references/commands.md`.
   - Hooks/events: read `references/hooks.md`.
   - Providers: read `references/providers.md`.
7. For TUI work, read `references/components.md` and Pi `docs/tui.md`.
8. For mode-sensitive UI, read `references/modes.md`.
9. For persistent state or custom messages, read `references/state.md` and `references/messages.md`.
10. For publishing, read `references/publish.md` and `references/documentation.md`.

### Modifying an existing extension

1. Read `package.json` to find Pi entry points.
2. Read the entry point and the relevant reference file.
3. Follow the extension's existing structure, even if it differs from the recommended multi-extension pattern. Do not restructure unless the user explicitly asks.
4. Check the current Pi docs/changelog if changing Pi APIs.
5. Update code and docs together.
6. Run typecheck and lint when available.

## Reference Files

| File | Content |
|---|---|
| `references/structure.md` | Multi-extension layout, package.json, pnpm-workspace.yaml, tsconfig, Biome config, config split, event bus, entry points, API-key pattern. |
| `references/tools.md` | `defineTool`, schemas, execute signature, prompt metadata, rendering, truncation, concurrency. |
| `references/commands.md` | Slash commands, argument completion, session methods, rich UI fallback. |
| `references/hooks.md` | Event lifecycle, blocking/cancelling, input transforms, settle boundary, project trust, system prompt hooks, bash hooks. |
| `references/components.md` | Pi TUI component interface, built-ins, custom UI, overlays, key handling. |
| `references/providers.md` | `pi.registerProvider(name, config)`, OAuth, streaming, model metadata. |
| `references/modes.md` | Interactive/RPC/JSON/Print behavior and fallback patterns. |
| `references/messages.md` | `sendMessage`, `registerMessageRenderer`, notification choices. |
| `references/state.md` | Reconstructible state via tool result `details`, `appendEntry` usage. |
| `references/additional-apis.md` | Shortcuts, flags, exec, session control, reload, stale contexts in deferred work, UI customization. |
| `references/publish.md` | npm publishing, changesets, GitHub Actions, pre-publish checklist. |
| `references/testing.md` | Local testing, smoke-loading an entry point, type checking, hook tests, core-unit testing, lifecycle regression tests. |
| `references/documentation.md` | README and changelog guidance. |

## Reference Extensions

Read these on GitHub (or a local clone) when you need a working example of a pattern:

- `github.com/aliou/pi-extension-template`: Multi-extension pattern, event bus, nested config, autocomplete provider, settings, publish workflow.
- `github.com/aliou/pi-linkup`: API tools, prompt metadata, output truncation, API-key gating.
- `github.com/aliou/pi-synthetic`: Provider + tools, command UI, API-key gating, project-trusted config.
- `github.com/aliou/pi-processes`: Multi-action process tool, prompt metadata plus orchestration guidance, unit-tested core manager.
- `github.com/aliou/pi-toolchain`: Config read at hook time, project-trusted config, `tool_call` hooks.
- `github.com/aliou/pi-ts-aperture`: Stale-ctx guards for deferred work, integration tests through pi's real `ExtensionRunner`.

## Critical Rules

1. When modifying an existing extension, preserve its current structure. Do not migrate to the multi-extension pattern unless the user explicitly asks.
2. `src/` is Pi-agnostic in new extensions: no imports from `@earendil-works/pi-*`. All Pi registration code lives under `extensions/`.
3. One Pi extension entry point per domain directory under `extensions/`. The main extension owns config, settings, and feature discovery.
4. Use the event bus (`src/events.ts`) for main-sub-extension communication: `domain:feature:request`, `domain:feature:register`, `domain:config:updated`.
5. Config in `src/config/` with `types.ts`, `defaults.ts`, `loader.ts`, and `migration/`. Use per-feature nested sections. Call `bindProjectConfig(pi, configLoader)` right after `load()` so project config is read only once Pi trusts the project, and read config when handlers run, not in the factory.
6. Build `parameters` with `@earendil-works/pi-schema` and define `type MyToolParams = Static<typeof parameters>` from it. Pi infers `execute` params as `unknown` for pi-schema schemas, so annotate `params: MyToolParams`; narrow `renderCall` args with `compile(parameters).check(args)`, since they can be partial.
7. Tool execute signature is `(toolCallId, params, signal, onUpdate, ctx)`. Signal comes before `onUpdate`.
8. Always call `onUpdate?.(...)` with optional chaining.
9. Every tool needs `label`. Add `promptSnippet` when the tool should appear in Available tools.
10. Every `promptGuidelines` bullet must name the exact tool. Do not say `this tool`.
11. Use pi-schema's `oneOf([...])` for model-facing string enums; it produces a plain `enum` schema every provider accepts.
12. Tool parameter schemas are plain JSON Schema validated by Pi. `default` is an annotation that validation never inserts; apply defaults and any constraint JSON Schema cannot express in `execute`.
13. Handle `renderResult` partial state first with a stable tool-scoped message.
14. Detect tool errors by missing expected `details` fields or `context.isError`; thrown tools receive `details: {}`.
15. Use `ToolCallHeader`, `ToolBody`, and conditional `ToolFooter` for tool rendering.
16. Use existing TUI components before creating custom components. Treat lines from any `render()` as read-only and copy before modifying them. Truncate with `truncateToWidth` from `@aliou/pi-utils-ui`, not pi-tui.
17. `ctx.ui.custom()` needs RPC/print fallback. Interactive close paths must not rely on `done(undefined)`. Inline components raised by the agent that wait for an answer pass `blocked: { kind, message }`; do not report dialogs the user opened themselves.
18. Keybinding hints use the `keyHint()`/`keyText()` injected into the tool render context and message/entry render options, never an import: an import can resolve to another pi-coding-agent copy that does not see pi's keybindings.
19. Dialog methods that gate behavior need `ctx.hasUI` checks; fire-and-forget UI methods do not.
20. Forward abort signals to `fetch`, `pi.exec`, SDK clients, and long-running work.
21. Use `pi.exec()` for normal shell commands. Do not use Node `child_process` unless a documented long-lived streaming process requires it.
22. File-mutating tools must normalize leading `@` paths and use `withFileMutationQueue()` for the full read-modify-write window.
23. Large output tools must truncate output, report truncation, and save full output to a temp file.
24. Store branch-aware tool state in tool result `details` and reconstruct from `ctx.sessionManager.getBranch()`.
25. After `ctx.newSession()`, `ctx.fork()`, or `ctx.switchSession()`, do post-switch work only in `withSession`. Deferred work (timers, sockets, un-awaited promises) checks a flag set in `session_shutdown` and drops stale-context errors: Pi has no `unhandledRejection` handler, so one escaping kills the process.
26. Treat `await ctx.reload(); return;` as terminal in a command handler.
27. Provider dynamic model discovery belongs in an async extension factory, not `session_start`.
28. Use SDK helpers for Pi paths instead of `homedir()` when helpers exist.
29. No `.js` extensions in TypeScript imports.
30. Pi core packages you import belong in optional `peerDependencies`; use `"*"` by default, or `">=x.y.z"` only when code needs an API introduced after Pi 0.74.0. Keep exact target versions in `devDependencies`.
31. `tsconfig.json` must include both `src/**/*.ts` and `extensions/**/*.ts`.
32. Published `package.json` lists `CHANGELOG.md` in `files` and uses no `catalog:` or `workspace:` versions. pnpm settings and Pi version overrides live in `pnpm-workspace.yaml`.

## Completion Checklist

- [ ] `package.json` lists extension entry points under `extensions/` and package resources.
- [ ] `src/` has no `@earendil-works/pi-*` imports.
- [ ] Config in `src/config/` with `types.ts`, `defaults.ts`, `loader.ts`, `migration/`.
- [ ] Each entry point that loads config calls `bindProjectConfig()`; handlers read config at run time.
- [ ] Event bus in `src/events.ts` with domain-prefixed event names.
- [ ] Main extension owns config loading, settings, and feature discovery.
- [ ] Sub-extensions register via event bus.
- [ ] Imported Pi core packages are optional peers and exact dev deps.
- [ ] Tools use `defineTool`, labels, prompt metadata where appropriate, correct execute order, optional `onUpdate`, and signal forwarding.
- [ ] `promptGuidelines` bullets name the exact tool.
- [ ] Tool renderers return components, handle partial/error states, and use compact collapsed views.
- [ ] Custom UI has RPC/print fallback and explicit sentinels.
- [ ] Providers use current provider/model fields (`name`, `authHeader`, `thinkingLevelMap`, OAuth where needed).
- [ ] State is reconstructible across reload/fork/compaction.
- [ ] Sockets, timers, and child processes close in `session_shutdown`; deferred work cannot touch a stale `pi` or `ctx`.
- [ ] No `child_process`, no `homedir()` for Pi paths, no `.js` import suffixes; schemas built only with `@earendil-works/pi-schema`.
- [ ] `tsconfig.json` includes both `src/` and `extensions/`.
- [ ] README documents setup, tools, commands, providers, env vars, and limitations.
- [ ] Typecheck and lint pass.
