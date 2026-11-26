# Tools

Tools are functions the LLM can call. They are the main way extensions add capabilities to Pi.

## Imports

Use the namespace that matches the target Pi package. Examples use the forward namespace.

```typescript
import { ToolBody, ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type { AgentToolResult, ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import {
  defineTool,
  formatSize,
  getMarkdownTheme,
  truncateHead,
  truncateTail,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { compile, obj, oneOf, opt, type Static, str } from "@earendil-works/pi-schema";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
```

Use legacy `@mariozechner/*` imports only when the target `@earendil-works/*` package is not available yet.

## Tool Extension Entry Point

Tool extensions live under `extensions/` and are normal Pi extension entry points. Export a default function and list the file in `package.json` `pi.extensions`.

```typescript
// extensions/tools/index.ts
import type { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { num, obj, opt, type Static, str } from "@earendil-works/pi-schema";
import { configLoader } from "../../src/config";

const parameters = obj({
  query: str({ description: "Search query" }),
  limit: opt(num({ description: "Max results", default: 10 })),
});

type MyToolParams = Static<typeof parameters>;

interface MyToolDetails {
  results: string[];
}

const myTool = defineTool({
  name: "my_tool",
  label: "My Tool",
  description: "Search for items by query.",
  promptSnippet: "Search for items by query",
  promptGuidelines: [
    "Use my_tool when the user asks to search these items.",
    "Prefer specific queries when calling my_tool.",
  ],
  parameters,

  async execute(_toolCallId, params: MyToolParams, signal, onUpdate, ctx): Promise<AgentToolResult<MyToolDetails>> {
    onUpdate?.({ content: [{ type: "text", text: "Searching..." }] });
    const results = await searchItems(params.query, { limit: params.limit, signal });
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      details: { results },
    };
  },
});

export default function toolsExtension(pi: ExtensionAPI) {
  await configLoader.load();
  if (!configLoader.getConfig().tools.enabled) return;
  pi.registerTool(myTool);
}
```

If the tool extension is a sub-extension, register with the main extension via the event bus (see `references/structure.md`).

## `defineTool()`

Use `defineTool({...})` for standalone tool objects.

Pi's `ToolDefinition` types cannot infer `params` from a pi-schema schema, so `execute` receives `unknown`. Declare `type MyToolParams = Static<typeof parameters>` from `@earendil-works/pi-schema` and annotate the `execute` parameter with it; Pi has already validated the arguments against `parameters` when `execute` runs.

Rules:

- Do not pass explicit generic arguments to `defineTool`.
- Annotate `params` in `execute` with the pi-schema `Static` alias, and use the same alias for helper functions and action modules.
- Leave `renderCall` arguments `unknown` and narrow them with a compiled check (see `renderCall`).
- If you want `renderResult` to know the `details` shape, annotate `execute` with `Promise<AgentToolResult<MyDetails>>`.

## Tool Definition Fields

| Field | Required | Notes |
|---|---:|---|
| `name` | Yes | Snake_case identifier used in tool calls. |
| `label` | Yes | Human-readable display name. |
| `description` | Yes | Model-facing description. |
| `parameters` | Yes | JSON Schema built with `@earendil-works/pi-schema`. |
| `execute` | Yes | `(toolCallId, params, signal, onUpdate, ctx)`. |
| `promptSnippet` | No | One-line entry in Available tools. Custom tools are omitted there when absent. |
| `promptGuidelines` | No | Raw bullets appended to the global Guidelines section. Each bullet must name the tool. |
| `prepareArguments` | No | Compatibility shim before schema validation. |
| `executionMode` | No | Use `"sequential"` for shared-state tools that cannot run concurrently. |
| `renderCall` / `renderResult` | No | Custom TUI component renderers. |
| `renderShell` | No | Use `"self"` only when the default boxed shell gets in the way. |

## Execute Signature

```typescript
async execute(toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<TDetails>>
```

Parameter order matters. `signal` comes before `onUpdate`.

Use optional chaining for updates:

```typescript
onUpdate?.({
  content: [{ type: "text", text: "Working..." }],
  details: { progress: 50 },
});
```

Forward `signal` to all abort-aware work:

```typescript
const response = await fetch(url, { signal });
const result = await pi.exec("git", ["status", "--porcelain"], { signal, cwd: ctx.cwd });
```

Do not use Node `child_process` for normal commands. Use `pi.exec(command, args, options)` so Pi handles CWD, cancellation, output capture, and lifecycle integration.

## Return Value and Errors

```typescript
return {
  content: [{ type: "text", text: "Text sent to the LLM" }],
  details: { rich: "data for rendering and state" },
  terminate: true, // optional final/structured-output tools only
};
```

- `content` is sent to the LLM. Keep it concise and useful.
- `details` is persisted in the session and used by renderers. Put state snapshots here when the tool mutates extension state.
- `terminate: true` skips the automatic follow-up LLM call only when every finalized tool in the current batch also terminates.
- Throw an error to mark a tool result as failed. Returning an object never sets `isError`.

When a tool throws, Pi creates an error result with `details: {}` and the error message in `content`. Renderers should check for missing expected fields or use the 4th render context's `isError` field.

## Parameters

Build schemas with `@earendil-works/pi-schema`. Its builders return plain JSON Schema typed with the values they accept, and Pi validates tool arguments with the same library. Always add useful descriptions.

```typescript
import { arr, bool, obj, oneOf, opt, type Static, str } from "@earendil-works/pi-schema";

const parameters = obj({
  path: str({ description: "File path" }),
  includeHidden: opt(bool({ description: "Include hidden files", default: false })),
  sort: opt(oneOf(["created", "updated", "relevance"], { description: "Sort order" })),
  tags: opt(arr(str({ description: "Tag" }))),
});

type ListParams = Static<typeof parameters>;
```

- Use `oneOf([...])` for model-facing string enums. It produces a plain `enum` schema every provider accepts, and `opt(oneOf(...))` stays optional in `Static`.
- `obj()` is closed (`additionalProperties: false`); pass `{ open: true }` only when extra properties are part of the contract.
- `default` is an annotation; validation never inserts it, so apply defaults in `execute`.
- Pi does not provide `@earendil-works/pi-schema` to extensions; list it in `dependencies`.

Before validation, Pi coerces loosely typed arguments: numeric strings to numbers, `"true"` to `true`, a single value to a one-item array, and `null` in an optional property dropped. Keep constraints expressible in JSON Schema and check anything else in `execute`.

## Prompt Metadata

`promptSnippet` and `promptGuidelines` affect different system prompt sections:

- `promptSnippet` adds one line under Available tools.
- `promptGuidelines` appends raw bullets to the global Guidelines section when the tool is active.

Because `promptGuidelines` are not grouped under the tool, each bullet must name the exact tool.

Good:

```typescript
promptGuidelines: [
  "Use repo_tree to inspect repository structure before reading individual files.",
  "Start repo_tree at the root path, then drill into directories as needed.",
]
```

Weak:

```typescript
promptGuidelines: [
  "Use this tool before reading files.",
  "Start at the root path.",
]
```

Use per-tool metadata for simple guidance. Use a `before_agent_start` hook for dynamic config, cross-tool workflows, or complex orchestration.

## Argument Compatibility

Use `prepareArguments(args)` for backward-compatible migrations of old session tool-call shapes. It runs before validation. Keep the public schema strict.

```typescript
prepareArguments(args) {
  if (!args || typeof args !== "object") return args;
  const input = args as { action?: string; oldAction?: string };
  if (typeof input.oldAction === "string" && input.action === undefined) {
    return { ...input, action: input.oldAction };
  }
  return args;
}
```

## Paths and File Mutation

If a tool accepts file paths, strip a leading `@` before resolving. Built-in tools do this because models sometimes include `@` from path mentions.

```typescript
const normalizedPath = params.path.startsWith("@") ? params.path.slice(1) : params.path;
const absolutePath = resolve(ctx.cwd, normalizedPath);
```

If a custom tool mutates files, wrap the whole read-modify-write window in `withFileMutationQueue()` so sibling parallel tool calls cannot overwrite each other.

```typescript
async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const normalizedPath = params.path.startsWith("@") ? params.path.slice(1) : params.path;
  const absolutePath = resolve(ctx.cwd, normalizedPath);

  return withFileMutationQueue(absolutePath, async () => {
    await mkdir(dirname(absolutePath), { recursive: true });
    const current = await readFile(absolutePath, "utf8");
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absolutePath, next, "utf8");
    return {
      content: [{ type: "text", text: `Updated ${normalizedPath}` }],
      details: { path: normalizedPath },
    };
  });
}
```

## Concurrency

Pi runs sibling tool calls in parallel by default. Add `executionMode: "sequential"` when this tool must serialize with sibling tool calls, for example when it mutates shared in-memory state, drives a cursor/game, or depends on strict call order.

```typescript
const statefulTool = defineTool({
  name: "game_move",
  label: "Game Move",
  description: "Apply a move to the current game state.",
  executionMode: "sequential",
  parameters,
  async execute(_toolCallId, params) {
    // Mutates shared in-memory state safely.
  },
});
```

Prefer making core operations concurrency-safe. Use sequential mode only when call order is inherently meaningful.

## Rendering

Custom renderers return TUI `Component` objects.

### `renderCall`

Use `ToolCallHeader` for a stable, scannable call line.

`renderCall` runs while the call streams, so its arguments can be partial and are typed `unknown`. Compile the parameter schema once and narrow with `check()`, falling back to a generic header:

```typescript
const repoTreeParams = compile(parameters);

renderCall(args, theme) {
  if (!repoTreeParams.check(args)) return new ToolCallHeader({ toolName: "Repo Tree" }, theme);
  return new ToolCallHeader(
    {
      toolName: "Repo Tree",
      action: args.action,
      mainArg: `${args.owner}/${args.repo}`,
      optionArgs: args.path ? [{ label: "path", value: args.path }] : [],
      longArgs: args.instructions ? [{ label: "instructions", value: args.instructions }] : [],
    },
    theme,
  );
}
```

Header extraction order:

1. Action for multi-action tools.
2. One main argument users scan for first.
3. Short option args.
4. Long args on follow-up lines.

### `renderResult`

Handle partial state first, then errors, then normal output.

The render context carries the injected `keyHint()`/`keyText()` for the host's configured keybindings. Use `context.keyHint(...)` for expand hints and never import `keyHint`/`keyText`: an import can resolve to another pi-coding-agent copy that does not see pi's keybindings, rendering the hint without the key.

```typescript
renderResult(result, options, theme, context) {
  if (options.isPartial) {
    return new Text(theme.fg("muted", "Repo Tree: fetching..."), 0, 0);
  }

  const { details } = result;
  if (!details?.entries) {
    const textBlock = result.content.find((c) => c.type === "text");
    const message = textBlock?.type === "text" ? textBlock.text : "Repo Tree failed";
    return new Text(theme.fg("error", message), 0, 0);
  }

  const fields = [
    { label: "Location", value: `${details.owner}/${details.repo}`, showCollapsed: true },
    { label: "Entries", value: `${details.entries.length}`, showCollapsed: true },
  ];

  const footerItems = [];
  if (!options.expanded && details.entries.length > 5) {
    footerItems.push({ value: context.keyHint("app.tools.expand", "to expand") });
  }

  return new ToolBody(
    {
      fields,
      footer: footerItems.length > 0 ? new ToolFooter(theme, { items: footerItems }) : undefined,
      includeSpacerBeforeFooter: fields.length > 0,
    },
    options,
    theme,
  );
}
```

Guidelines:

- Partial output uses a fixed tool-scoped message; do not echo streaming content.
- Collapsed view should show useful preview, not just `ok`.
- Expanded view can add full details.
- Omit empty footers.
- Use `Markdown` with `getMarkdownTheme()` for rich markdown.
- Use `context.lastComponent` only when reusing a component instance buys real performance.
- The render context also carries `durationMs` (execution time of the final result, `undefined` while it runs) alongside `expanded`, `isPartial`, and `isError`.
- Set `renderShell: "self"` only when the default boxed shell prevents the desired layout.

Use `pi.registerToolRenderer()` to choose how calls to a tool you did not register are drawn, such as MCP tools in resumed sessions.

## Output Truncation

Tools must avoid overwhelming model context. Use `truncateHead` for content where the beginning matters and `truncateTail` for logs or command output where the end matters.

```typescript
interface FetchDetails {
  url: string;
  content: string;
  truncated: boolean;
  totalLines: number;
  outputLines: number;
  totalBytes: number;
  outputBytes: number;
  tempFile?: string;
}

async execute(_toolCallId, params, signal): Promise<AgentToolResult<FetchDetails>> {
  const response = await fetch(params.url, { signal });
  const fullContent = await response.text();
  const truncated = truncateHead(fullContent, { maxBytes: 50_000, maxLines: 2_000 });

  const details: FetchDetails = {
    url: params.url,
    content: truncated.content,
    truncated: truncated.truncated,
    totalLines: truncated.totalLines,
    outputLines: truncated.outputLines,
    totalBytes: truncated.totalBytes,
    outputBytes: truncated.outputBytes,
  };

  let text = truncated.content;
  if (truncated.truncated) {
    details.tempFile = await writeTempFile(fullContent);
    text += `\n\n[Output truncated: ${truncated.outputLines}/${truncated.totalLines} lines, `;
    text += `${formatSize(truncated.outputBytes)}/${formatSize(truncated.totalBytes)}. `;
    text += `Full output: ${details.tempFile}]`;
  }

  return { content: [{ type: "text", text }], details };
}
```

Always tell the LLM when output was truncated and where full output was saved.

## Multi-Action Tools

Use a directory when one tool has several actions.

```
tools/my_tool/
  index.ts
  actions/start.ts
  actions/list.ts
  actions/kill.ts
  render.ts
  types.ts
```

Pattern:

- `types.ts`: parameter schema, `Static` alias, details/result types.
- `actions/*`: Pi-free or mostly Pi-free action logic.
- `render.ts`: `renderCall`/`renderResult` when complex.
- `index.ts`: `defineTool`, execute switch, registration.

Inside the `defineTool` execute callback, inference is enough. If action functions need typed inputs, use the alias from `types.ts`.

```typescript
async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<MyToolDetails>> {
  switch (params.action) {
    case "start":
      return startAction(client, params, signal, onUpdate, ctx);
    case "list":
      return listAction(client, params, signal);
    default:
      throw new Error(`Unknown action: ${params.action}`);
  }
}
```

## Naming

- Use snake_case tool names.
- Prefix third-party integrations with the API/product name (`linkup_web_search`, `linear_issue`).
- Internal tools can use direct names (`get_current_time`, `process`).
- Display names in UI should use `label`, not raw tool IDs.

## Checklist

- [ ] Tool uses `defineTool({...})` with no explicit generic args.
- [ ] `parameters` is built with `@earendil-works/pi-schema`, listed in `dependencies`.
- [ ] `execute` annotates `params` with the pi-schema `Static<typeof parameters>` alias; `renderCall` narrows `args` with a compiled `check()`.
- [ ] `label`, `description`, and useful parameter descriptions are present.
- [ ] `promptGuidelines` bullets name the exact tool.
- [ ] Execute signature is `(toolCallId, params, signal, onUpdate, ctx)`.
- [ ] `onUpdate` uses optional chaining.
- [ ] `signal` is forwarded to async operations.
- [ ] Errors are thrown, not returned as fake success payloads.
- [ ] Path tools strip leading `@`; mutating tools use `withFileMutationQueue()`.
- [ ] Shared-state tools use safe concurrency or `executionMode: "sequential"`.
- [ ] Large outputs are truncated with a full-output temp file.
- [ ] Renderers return components, handle partial first, handle errors, and omit empty footers.
