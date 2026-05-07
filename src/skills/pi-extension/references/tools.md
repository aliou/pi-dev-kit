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
  keyHint,
  truncateHead,
  truncateTail,
  withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { type Static, Type } from "typebox";
```

Use legacy `@mariozechner/*` imports only when the target `@earendil-works/*` package is not available yet.

## Minimal Tool Entry Point

Tool entry points are normal Pi extension entry points. Export a default function and list the file in `package.json` `pi.extensions`.

```typescript
const parameters = Type.Object({
  query: Type.String({ description: "Search query" }),
  limit: Type.Optional(Type.Number({ description: "Max results", default: 10 })),
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

  async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<MyToolDetails>> {
    onUpdate?.({ content: [{ type: "text", text: "Searching..." }] });
    const results = await searchItems(params.query, { limit: params.limit, signal });
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      details: { results },
    };
  },
});

export default function toolsExtension(pi: ExtensionAPI) {
  pi.registerTool(myTool);
}
```

## `defineTool()`

Use `defineTool({...})` for standalone tool objects. It preserves parameter inference from the `parameters` field when the tool is stored in a variable or passed through arrays.

Rules:

- Do not pass explicit generic arguments to `defineTool`.
- Do not annotate callback parameters unless TypeScript needs help.
- Add a `Static<typeof parameters>` alias for helper functions and action modules.
- If you want `renderResult` to know the `details` shape, annotate `execute` with `Promise<AgentToolResult<MyDetails>>`.

## Tool Definition Fields

| Field | Required | Notes |
|---|---:|---|
| `name` | Yes | Snake_case identifier used in tool calls. |
| `label` | Yes | Human-readable display name. |
| `description` | Yes | Model-facing description. |
| `parameters` | Yes | TypeBox 1.x schema from `typebox`. |
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

Use TypeBox 1.x from `typebox`. Always add useful descriptions.

```typescript
const parameters = Type.Object({
  path: Type.String({ description: "File path" }),
  includeHidden: Type.Optional(Type.Boolean({ description: "Include hidden files", default: false })),
  sort: Type.Optional(StringEnum(["created", "updated", "relevance"] as const, {
    description: "Sort order",
  })),
  tags: Type.Optional(Type.Array(Type.String({ description: "Tag" }))),
});
```

Use `StringEnum` from `pi-ai` for model-facing string enums. Avoid `Type.Union([Type.Literal(...)])`; it is not compatible with all providers.

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

```typescript
renderCall(args, theme) {
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

```typescript
renderResult(result, options, theme) {
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
    footerItems.push({ value: keyHint("app.tools.expand", "to expand") });
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
- Set `renderShell: "self"` only when the default boxed shell prevents the desired layout.

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
- [ ] Params infer from `parameters`; helper APIs use `Static<typeof parameters>` alias.
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
