# Tools

Tools are functions the LLM can call. They are the primary way extensions add capabilities to pi.

## Imports

Use these imports at the top of your tool file:

```typescript
import { ToolCallHeader, ToolBody, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { defineTool, getMarkdownTheme, keyHint, truncateHead, formatSize } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "typebox";
```

## Registration

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
  label: "My Tool", // Required: human-readable name for UI
  description: "What this tool does. The LLM reads this to decide when to call it.",
  promptSnippet: "Search for items by query", // One-liner for "Available tools" system prompt
  promptGuidelines: [ // Guideline bullets appended verbatim to the global "Guidelines" section when this tool is active
    "Use my_tool when the user asks about search.",
    "Prefer specific queries over broad ones when calling my_tool.",
  ],
  parameters,

  async execute(
    toolCallId,
    params,
    signal,
    onUpdate,
    ctx,
  ): Promise<AgentToolResult<MyToolDetails>> {
    const results = await doSomething(params.query, params.limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      details: { results },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(myTool);
}
```

## Tool Definition Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Snake_case identifier used in tool calls |
| `label` | `string` | Yes | Human-readable name shown in UI |
| `description` | `string` | Yes | What the tool does (LLM reads this) |
| `parameters` | `TSchema` | Yes | TypeBox schema for arguments |
| `promptSnippet` | `string` | No | One-liner injected into "Available tools" system prompt. Custom tools without this are omitted from that section. |
| `promptGuidelines` | `string[]` | No | Guideline bullets appended verbatim to the global "Guidelines" system prompt section when this tool is active. Write each bullet so it still makes sense standalone. |
| `execute` | `function` | Yes | Implementation |
| `renderCall` | `function` | No | Custom call rendering |
| `renderResult` | `function` | No | Custom result rendering |

## `defineTool()` and Typed Param Alias

Use `defineTool()` for standalone tool definitions. It infers parameter types from the `parameters` field and preserves them for `execute`, `renderCall`, and `renderResult` so you do not need casts or explicit generic arguments at registration/rendering boundaries.

Inside the `defineTool({...})` object, do not annotate callback parameter types unless TypeScript actually needs help. The contextual type from Pi already provides `toolCallId`, `params`, `signal`, `onUpdate`, `ctx`, `options`, and `theme`. If you want `renderResult` to see a specific `details` shape, annotate the `execute` return type as `Promise<AgentToolResult<MyToolDetails>>`; that is the useful annotation.

Define a type alias at the top of your file instead of repeating `Static<typeof parameters>`:

```typescript
const parameters = Type.Object({
  query: Type.String({ description: "Search query" }),
  limit: Type.Optional(Type.Number({ description: "Max results", default: 10 })),
});

type MyToolParams = Static<typeof parameters>;
// Use MyToolParams in helper functions and exported action APIs. Inside defineTool callbacks, prefer inference.
```

## Execute Signature

```typescript
execute(toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<TDetails>>
```

Pi's `ToolDefinition` type is:

```typescript
execute(
  toolCallId: string,
  params: Static<TParams>,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
  ctx: ExtensionContext,
): Promise<AgentToolResult<TDetails>>
```

You usually do not need to write those parameter types yourself inside `defineTool()`.

**Parameter order matters.** The signal comes before onUpdate.

Always use optional chaining when calling `onUpdate`:

```typescript
onUpdate?.({ output: "partial result", details: { progress: 50 } });
```

The `onUpdate` parameter can be `undefined`. Calling it without optional chaining will throw.

## Tool Overrides and Delegation

If you override a built-in tool or wrap another tool, audit any delegated `tool.execute(...)` calls during upgrades. These forwarders often pass through `signal`, `onUpdate`, or `ctx` and can silently break when the execute signature changes. Always recheck the delegate call parameter order and include optional parameters that the target tool expects.

Prompt metadata is not inherited automatically when you override a built-in tool. If the original tool had `promptSnippet` or `promptGuidelines` and you still want that system prompt behavior, define those fields explicitly on the override.

## Return Value

```typescript
return {
  content: (TextContent | ImageContent)[],  // Content blocks sent to the LLM
  details?: TDetails,                       // Arbitrary data available in the renderer
  terminate?: boolean,                      // Optional: skip follow-up LLM call when all finalized results in the batch terminate
};
```

- `content` is what the LLM sees. Each block is `{ type: "text", text: "..." }` or an image. Keep it structured and concise.
- `details` is what the renderer sees. Put rich data here for custom display.
- `terminate: true` is for final/structured-output tools that should end the turn without an automatic follow-up LLM call. It only applies when every finalized tool result in the current batch also returns `terminate: true`.

Common pattern:

```typescript
return {
  content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
  details: { results },
};
```

## Error Handling

To report a tool call failure, **throw an error**. The framework catches it and produces a result with `isError: true` on the context.

```typescript
execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  const result = await fetchData(params.query);
  if (!result) {
    throw new Error("No results found. Try a different query.");
  }
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    details: { result },
  };
},
```

The framework's `createErrorToolResult` sets `details: {}` (empty object, not `undefined`) and puts the error message in `content`:

```typescript
// Framework produces when tool throws:
{
  content: [{ type: "text", text: errorMessage }],
  details: {}
}
// And sets context.isError = true in renderResult
```

### Error rendering in `renderResult`

The framework passes `isError` on the 4th `context` parameter to `renderResult`, but `ToolRenderContext` is not currently exported from the public API. Two practical approaches:

**Approach 1: Check for missing expected fields in `details`** (recommended for extensions)

When a tool throws, the framework sets `details: {}` (empty object). Check for missing expected fields:

```typescript
renderResult(
  result: AgentToolResult<MyToolDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  const { details } = result;

  // details is {} when tool threw — expected fields are missing
  if (!details?.results) {
    const textBlock = result.content.find((c) => c.type === "text");
    const errorMsg = (textBlock?.type === "text" && textBlock.text) || "Operation failed";
    return new Text(theme.fg("error", errorMsg), 0, 0);
  }
  // ... normal rendering
}
```

**Approach 2: Use the 4th context parameter** (used by native tools)

Define a minimal interface locally:

```typescript
interface RenderContext { isError: boolean }

renderResult(
  result: AgentToolResult<MyToolDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
  context: RenderContext,
) {
  if (context.isError) {
    const textBlock = result.content.find((c) => c.type === "text");
    const errorMsg = textBlock?.type === "text" ? textBlock.text : "Operation failed";
    return new Text(theme.fg("error", errorMsg), 0, 0);
  }
  // ... normal rendering
}
```

Both approaches work. Approach 1 is more common in published extensions. Approach 2 is what native tools use.

## Parameters Schema

Use TypeBox 1.x (`Type.*`) from `typebox` for parameter schemas. The LLM sees the schema to know what arguments to provide. Do not import from `@sinclair/typebox` in new extensions.

```typescript
import { Type } from "typebox";

// Required string
Type.String({ description: "File path to read" })

// Optional with default
Type.Optional(Type.Number({ description: "Max results", default: 10 }))

// Enum (string union)
Type.StringEnum(["created", "updated", "relevance"], { description: "Sort order" })

// Boolean
Type.Boolean({ description: "Include hidden files" })

// Nested object
Type.Object({
  name: Type.String(),
  value: Type.String(),
})

// Array
Type.Array(Type.String(), { description: "List of tags" })
```

Always provide `description` on parameters. The LLM uses these to understand what to pass.

## Prompt Metadata

`promptSnippet` and `promptGuidelines` affect different parts of the default system prompt:

- `promptSnippet` adds a one-line entry to `Available tools`.
- `promptGuidelines` appends raw bullets to the global `Guidelines` section.

Important implications:

- `promptGuidelines` bullets are not wrapped with the tool name.
- Write bullets so they still make sense when read out of context.
- Prefer explicit tool names over phrases like `this tool`.

Good:

```typescript
promptGuidelines: [
  "Use my_tool to search project docs before broader web research.",
  "Prefer specific queries when calling my_tool.",
]
```

Weak:

```typescript
promptGuidelines: [
  "Use this tool for docs.",
  "Prefer specific queries.",
]
```

Use `promptGuidelines` for short, tool-local rules. If the guidance needs cross-tool sequencing, comparisons against several tools, or dynamic config context, use a `before_agent_start` hook instead.

## Argument Compatibility and Path Handling

Use `prepareArguments(args)` when you need a compatibility shim before schema validation, for example to support an old parameter shape during a migration.

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

If your custom tool accepts filesystem paths, normalize a leading `@` before resolving the path. Some models include `@` in path arguments, and the built-in file tools already strip it.

```typescript
const normalizedPath = params.path.startsWith("@") ? params.path.slice(1) : params.path;
```

## File-Mutating Tools and Concurrency

Tool calls can run in parallel. If your custom tool mutates files, use `withFileMutationQueue()` so it participates in the same per-file queue as built-in `edit` and `write`.

```typescript
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

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
      details: {},
    };
  });
}
```

Queue the whole read-modify-write window, not just the final write.

## Streaming Updates

Use `onUpdate` to stream partial results while the tool executes. This gives the user feedback during long operations.

```typescript
execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  for (const chunk of chunks) {
    const partial = processChunk(chunk);
    onUpdate?.({
      content: [{ type: "text", text: partial }],
      details: { progress: chunk.index / chunks.length },
    });
  }
  return {
    content: [{ type: "text", text: finalResult }],
    details: { complete: true },
  };
},
```

## Custom Rendering

Override how a tool's invocation and result appear in the TUI.

### `renderCall` Signature

```typescript
renderCall(args: MyToolParams, theme: Theme): Component
```

A 3rd `context` param is available from the framework but rarely needed in `renderCall`.

Use `ToolCallHeader` from `@aliou/pi-utils-ui`:

```typescript
renderCall(args: MyToolParams, theme: Theme) {
  return new ToolCallHeader(
    {
      toolName: "My Tool",
      action: "search",           // Optional: for multi-action tools
      mainArg: `"${args.query}"`, // Primary thing user scans for
      optionArgs: [`limit=${args.limit ?? 10}`], // Compact key-value pairs
      longArgs: [],               // Long text goes here
      showColon: true,            // Whether to show colon after tool name
    },
    theme,
  );
}
```

### `renderResult` Signature

```typescript
renderResult(
  result: AgentToolResult<TDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
): Component
```

- `options` has `expanded` and `isPartial`
- `result.details` is `{}` (empty object) when the tool threw an error
- A 4th `context` param is available (see Error Handling above) but not required

```typescript
renderResult(
  result: AgentToolResult<MyToolDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  // 1. Handle partial state first with stable message
  if (options.isPartial) {
    return new Text(theme.fg("muted", "MyTool: fetching..."), 0, 0);
  }

  const { details } = result;

  // 2. Handle errors: details is {} when tool threw
  if (!details?.results) {
    const textBlock = result.content.find((c) => c.type === "text");
    const errorMsg = (textBlock?.type === "text" && textBlock.text) || "Operation failed";
    return new Text(theme.fg("error", errorMsg), 0, 0);
  }

  // 3. Build fields for ToolBody (showCollapsed controls collapsed/expanded visibility)
  const items = details.results;

  const fields: Array<{ label: string; value: string; showCollapsed?: boolean } | Text> = [
    { label: "Results", value: `${items.length} items`, showCollapsed: true },
  ];

  // 4. Build conditional footer
  const footerItems: Array<{ label: string; value: string }> = [];
  if (items.length > 0) {
    footerItems.push({ label: "count", value: `${items.length}` });
  }

  return new ToolBody(
    {
      fields,
      footer: footerItems.length > 0
        ? new ToolFooter(theme, { items: footerItems, separator: " | " })
        : undefined,
      includeSpacerBeforeFooter: fields.length > 0,
    },
    options,
    theme,
  );
}
```

### `renderCall` Design Guide

The `process` extension is a good baseline. Its call renderer is deterministic and keeps headers readable.

Use this extraction order when building header parts:

1. **Action first**: always show action for multi-action tools (`start`, `list`, `kill`, ...).
2. **Pick one main arg**: choose the single value the user scans for first (name, id, or short command).
3. **Promote short fields to options**: compact values become option args (`end=true`, `limit=10`).
4. **Demote long fields to long args**: commands/prompts/instructions move to labeled follow-up lines.
5. **Keep it stable**: same inputs should produce same ordering and formatting.

Implementation pattern:
- Build `mainArg`, `optionArgs`, `longArgs` first, then pass to `ToolCallHeader`.
- Quote user-provided names (`"backend"`) when that improves visual parsing.
- Cap inline length (e.g. 60-80 chars), then spill to `longArgs`.

### `renderResult` Guidelines

- Handle `isPartial` first with a **stable, tool-scoped message** like `"MyTool: fetching..."`. Do NOT echo streaming content.
- Handle errors by checking for missing expected fields in `details` (framework sets `details: {}` on throw). Alternatively use the 4th `context` param with `context.isError`.
- Use `ToolBody` with `showCollapsed: true` fields for collapsed/expanded filtering.
- Use `ToolFooter` for stats/metadata. Omit when empty: `footer: items.length > 0 ? new ToolFooter(...) : undefined`.
- Use `includeSpacerBeforeFooter: fields.length > 0` to avoid blank line when body is empty.
- Remove redundant success footer items — don't show `status: ok` when success is obvious.
- Use `Container` + `addChild()` for multi-element results instead of string concatenation.
- Use `Markdown` component for rich markdown content:
  ```typescript
  new Markdown(text, 0, 0, getMarkdownTheme(), { color: (t) => theme.fg("toolOutput", t) })
  ```
- Use `keyHint("app.tools.expand", "to expand")` for expand hints.
- Collapsed result should show **actionable preview** (last N lines, first N items with status), not just a status badge.
- Humanize error messages with names first: `"Could not get X for "name" (id)"`.

## Tool UI Rendering Guidelines

When customizing tool rendering, keep call/result UI predictable and scannable.

### `renderCall` format

Use this line model:

- First line: `[Tool Name]: [Action] [Main arg] [Option args]`
- Additional lines: long args only

Guidelines:
- Tool name should be a human display label (`label`), not a raw internal identifier (`name`).
- Show `action` only when it adds meaning (multi-action tools like process managers).
- Main arg should be the primary thing user cares about (query, session id, target id/name).
- Option args should be compact key-value pairs (`limit=10`, `cwd=/path`).
- Long text (prompt/task/question/context/instructions) goes to additional lines.
- Prefer wrapping to preserve full meaning over aggressive truncation.
- For tools without actions, omit colon suffix after tool name if that reads better in your UI system.

### `renderResult` layout

- Handle `isPartial` first. Return a short stable loading state with tool-scoped message.
- Keep the first non-loading line as a status summary (`Found N results`, `Updated 3 files`, `Failed: reason`).
- Use `expanded` to switch between compact and full output. Compact should show the top few items plus an omission hint.
- Keep body content focused on state + key output; avoid dumping raw JSON unless it is the actual output.
- If you render a footer (stats, backend, counts), use `includeSpacerBeforeFooter` to control blank line.
- Keep footer concise and stable across states.
- Return `undefined` when custom rendering adds no value; fallback rendering is better than noisy UI.

## Tool Call + UI Consistency Contract

Use this contract to keep tool UX consistent across extensions:

1. **Call line is for scanability**: `renderCall` first line follows `[Tool Name]: [Action] [Main arg] [Option args]`.
2. **Result detects errors** by checking for missing expected fields in `details` (framework sets `details: {}` on throw).
3. **Long text moves down**: prompts, instructions, and context go to follow-up lines, not the call header.
4. **Partial updates use a fixed tool-scoped string**, not echoed streaming content.
5. **Expanded controls density**: compact view shows summary + subset; expanded view shows full detail.
6. **No mode leaks in tool renderers**: `renderCall`/`renderResult` should not branch on mode. Mode-specific behavior belongs in command/tool logic (`references/modes.md`).

Related references:
- `references/modes.md` for `custom()` fallback behavior and RPC/Print handling.
- `references/components.md` for interactive component authoring.
- `references/messages.md` for persistent display via `sendMessage` + `registerMessageRenderer`.

## Naming Conventions

For extensions wrapping a third-party API, prefix tool names with the API name to avoid conflicts:

```
linkup_web_search
linkup_web_fetch
synthetic_web_search
```

For internal/custom tools, no prefix is needed:

```
get_current_time
processes
```

Use snake_case for all tool names.

## Abort Signal

The `signal` parameter lets you cancel long-running operations when the user interrupts (e.g. pressing Escape). If the tool does not forward the signal, the underlying operation keeps running even after the user cancels, wasting resources and API credits.

```typescript
execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  const response = await fetch(url, { signal });
  // If the user cancels, fetch throws an AbortError
  return { content: [{ type: "text", text: await response.text() }], details: {} };
},
```

Pass `signal` to every async operation that supports it: `fetch()` calls, `pi.exec()` calls, SDK clients, etc.

When wrapping an API client, thread the signal through the entire call chain. The client methods should accept an optional `signal` and forward it to the underlying `fetch()`:

```typescript
// In the tool:
async execute(_toolCallId, params, signal, onUpdate, ctx) {
  const result = await client.search({ query: params.query, signal });
  // ...
}

// In the client:
async search(params: { query: string; signal?: AbortSignal }) {
  return this.request("/search", { method: "POST", body: ... }, params.signal);
}

private async request<T>(endpoint: string, options: RequestInit = {}, signal?: AbortSignal) {
  return fetch(`${BASE_URL}${endpoint}`, { ...options, signal, headers: { ... } });
}
```

Do not prefix signal with underscore (`_signal`) unless the tool genuinely cannot use it. A dangling `_signal` is a sign of a missing cancellation path.

## Output Truncation

For tools that may return large outputs, use `truncateHead()` which returns a `TruncationResult`:

```typescript
import { truncateHead, formatSize } from "@mariozechner/pi-coding-agent";
import { createWriteStream } from "fs";
import { tmpdir } from "os";
import { join } from "path";

interface FetchDetails {
  content: string;
  url: string;
  truncated: boolean;
  totalLines: number;
  totalBytes: number;
  outputLines: number;
  outputBytes: number;
  tempFile?: string;
}

async execute(
  _toolCallId: string,
  params: FetchParams,
  signal: AbortSignal | undefined,
  _onUpdate: undefined,
  _ctx: ExtensionContext,
): Promise<AgentToolResult<FetchDetails>> {
  const response = await fetch(params.url, { signal });
  const fullContent = await response.text();

  // truncateHead keeps the tail (most recent content)
  const truncated = truncateHead(fullContent, {
    maxBytes: 50000,
    maxLines: 2000,
  });

  const details: FetchDetails = {
    content: truncated.content,
    url: params.url,
    truncated: truncated.truncated,
    totalLines: truncated.totalLines,
    totalBytes: truncated.totalBytes,
    outputLines: truncated.outputLines,
    outputBytes: truncated.outputBytes,
  };

  // Write full content to temp file if truncated
  if (truncated.truncated) {
    const tempFile = join(tmpdir(), `web-fetch-${Date.now()}.txt`);
    const stream = createWriteStream(tempFile);
    stream.write(fullContent);
    stream.end();
    details.tempFile = tempFile;
  }

  return {
    content: [{ type: "text", text: truncated.content }],
    details,
  };
}
```

### Truncation Result Fields

```typescript
interface TruncationResult {
  content: string;      // The truncated content (or full if not truncated)
  truncated: boolean;   // Whether truncation occurred
  totalLines: number;   // Original total lines
  totalBytes: number;   // Original total bytes
  outputLines: number;  // Lines in output
  outputBytes: number;  // Bytes in output
}
```

### Rendering Truncated Output

```typescript
renderResult(
  result: AgentToolResult<FetchDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  if (options.isPartial) {
    return new Text(theme.fg("muted", "WebFetch: fetching..."), 0, 0);
  }

  const { details } = result;

  if (!details?.content) {
    const textBlock = result.content.find((c) => c.type === "text");
    const errorMsg = (textBlock?.type === "text" && textBlock.text) || "Fetch failed";
    return new Text(theme.fg("error", errorMsg), 0, 0);
  }
  const container = new Container();

  // Body with content preview
  const fields = [
    { label: "URL", value: details.url, showCollapsed: true },
    { label: "Size", value: formatSize(details.totalBytes), showCollapsed: true },
  ];

  container.addChild(new ToolBody(theme, { fields, expanded: options.expanded }));

  // Footer with truncation info
  const footerItems = [];

  if (details.truncated) {
    footerItems.push(
      { label: "showing", value: `${details.outputLines}/${details.totalLines} lines` },
      { label: "full output", value: details.tempFile ?? "temp file" },
    );
  } else {
    footerItems.push({ label: "lines", value: `${details.totalLines}` });
  }

  container.addChild(
    new ToolFooter(theme, {
      items: footerItems,
      separator: " | ",
      includeSpacerBeforeFooter: fields.length > 0,
    }),
  );

  return container;
}
```

## Multi-Action Tools

For tools with multiple actions (e.g., `start`, `list`, `kill`), organize code for maintainability:

### File Structure

```
tools/
  my_tool/
    index.ts           // Tool definition, registration, execute switch
    actions/
      start.ts         // start action implementation
      list.ts          // list action implementation
      kill.ts          // kill action implementation
    render.ts          // renderCall and renderResult (when complex)
    types.ts           // Shared types and param schema
```

### Action Pattern

Each action takes an SDK client and typed params, returns typed results:

```typescript
// actions/start.ts
export interface StartParams {
  name: string;
  command: string;
  cwd?: string;
}

export interface StartResult {
  sessionId: string;
  pid: number;
}

export async function start(
  client: MyClient,
  params: StartParams,
  signal?: AbortSignal,
): Promise<StartResult> {
  return client.startSession({
    name: params.name,
    command: params.command,
    cwd: params.cwd,
    signal,
  });
}
```

### Execute Delegation

```typescript
// index.ts
async execute(
  toolCallId: string,
  params: MyToolParams,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<MyToolDetails> | undefined,
  ctx: ExtensionContext,
): Promise<AgentToolResult<MyToolDetails>> {
  switch (params.action) {
    case "start":
      return startAction(client, params, signal, onUpdate, ctx);
    case "list":
      return listAction(client, params, signal);
    case "kill":
      return killAction(client, params, signal);
    default:
      throw new Error(`Unknown action: ${params.action}`);
  }
}
```

### Separate Render Module

When rendering is complex, extract to `render.ts`:

```typescript
// render.ts
export function renderCall(args: MyToolParams, theme: Theme) {
  return new ToolCallHeader(
    {
      toolName: "MyTool",
      action: args.action,
      mainArg: getMainArg(args),
      optionArgs: getOptionArgs(args),
      longArgs: getLongArgs(args),
    },
    theme,
  );
}

export function renderResult(
  result: AgentToolResult<MyToolDetails>,
  options: ToolRenderResultOptions,
  theme: Theme,
) {
  // Complex rendering logic here
}
```

```typescript
// index.ts
import { renderCall, renderResult } from "./render.js";

const myTool = {
  // ...
  renderCall,
  renderResult,
};
```

**Examples to reference:**
- `pi-processes`: Multi-action process management with complex rendering
- `pi-linear`: Multi-action Linear API integration

## Full Example

Here's a realistic tool demonstrating all the patterns:

```typescript
import { ToolCallHeader, ToolBody, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { keyHint, formatSize } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "typebox";

// Schema
const parameters = Type.Object({
  owner: Type.String({ description: "Repository owner" }),
  repo: Type.String({ description: "Repository name" }),
  path: Type.Optional(Type.String({ description: "File or directory path", default: "" })),
});

// Typed aliases
type RepoTreeParams = Static<typeof parameters>;

interface RepoTreeDetails {
  owner: string;
  repo: string;
  path: string;
  entries: Array<{ name: string; type: "file" | "dir"; size?: number }>;
  truncated: boolean;
}

// Tool definition
const repoTreeTool = {
  name: "repo_tree",
  label: "Repo Tree",
  description: "List files and directories in a GitHub repository.",
  promptSnippet: "Browse repository file structure",
  promptGuidelines: [
    "Use repo_tree to explore repository structure before reading files.",
    "Start repo_tree at the root path, then drill down into directories.",
  ],
  parameters,

  async execute(
    _toolCallId: string,
    params: RepoTreeParams,
    signal: AbortSignal | undefined,
    _onUpdate: undefined,
    _ctx: ExtensionContext,
  ): Promise<AgentToolResult<RepoTreeDetails>> {
    const response = await fetch(
      `https://api.github.com/repos/${params.owner}/${params.repo}/contents/${params.path ?? ""}`,
      { signal, headers: { Accept: "application/vnd.github.v3+json" } },
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Could not find repository "${params.owner}/${params.repo}" or path "${params.path ?? ""}"`,
        );
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // GitHub returns a single object for files, array for directories
    const entries = Array.isArray(data) ? data : [data];

    const processed = entries.map((entry: any) => ({
      name: entry.name,
      type: entry.type === "dir" ? "dir" as const : "file" as const,
      size: entry.size,
    }));

    // Sort: directories first, then files, alphabetically within each
    processed.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const truncated = processed.length > 100;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(truncated ? processed.slice(0, 100) : processed, null, 2),
        },
      ],
      details: {
        owner: params.owner,
        repo: params.repo,
        path: params.path ?? "",
        entries: processed,
        truncated,
      },
    };
  },

  renderCall(args: RepoTreeParams, theme: Theme) {
    return new ToolCallHeader(
      {
        toolName: "Repo Tree",
        mainArg: `${args.owner}/${args.repo}`,
        optionArgs: args.path ? [`path=${args.path}`] : [],
        longArgs: [],
      },
      theme,
    );
  },

  renderResult(
    result: AgentToolResult<RepoTreeDetails>,
    options: ToolRenderResultOptions,
    theme: Theme,
  ) {
    // 1. Stable partial message
    if (options.isPartial) {
      return new Text(theme.fg("muted", "RepoTree: fetching..."), 0, 0);
    }

    const { details } = result;

    // 2. Error handling: details is {} when tool threw
    if (!details?.entries) {
      const textBlock = result.content.find((c) => c.type === "text");
      const errorMsg = (textBlock?.type === "text" && textBlock.text) || "Failed to list repository";
      return new Text(theme.fg("error", errorMsg), 0, 0);
    }
    const container = new Container();
    const entries = details?.entries ?? [];
    const dirs = entries.filter((e) => e.type === "dir");
    const files = entries.filter((e) => e.type === "file");

    // 3. Body fields with showCollapsed for collapsed/expanded control
    const fields: Array<{ label: string; value: string; showCollapsed: boolean }> = [
      {
        label: "Location",
        value: `${details.owner}/${details.repo}${details.path ? `/${details.path}` : ""}`,
        showCollapsed: true,
      },
      {
        label: "Contents",
        value: `${dirs.length} dirs, ${files.length} files`,
        showCollapsed: true,
      },
    ];

    container.addChild(new ToolBody(theme, { fields, expanded: options.expanded }));

    // 4. Entry list (in expanded view)
    if (options.expanded && entries.length > 0) {
      const entryLines = entries
        .slice(0, 50)
        .map((e) => {
          const icon = e.type === "dir" ? "📁" : "📄";
          const size = e.size !== undefined ? ` (${formatSize(e.size)})` : "";
          return `${icon} ${e.name}${size}`;
        })
        .join("\n");

      container.addChild(new Text(entryLines, 0, 0));

      if (entries.length > 50) {
        container.addChild(
          new Text(theme.fg("muted", `... and ${entries.length - 50} more`), 0, 0),
        );
      }
    }

    // 5. Conditional footer
    const footerItems = [];

    if (details?.truncated) {
      footerItems.push({ label: "showing", value: "first 100 entries" });
    }

    if (entries.length > 0) {
      footerItems.push({ label: "total", value: `${entries.length} items` });
    }

    if (!options.expanded && entries.length > 5) {
      footerItems.push({ label: "", value: keyHint("app.tools.expand", "to expand") });
    }

    if (footerItems.length > 0) {
      container.addChild(
        new ToolFooter(theme, {
          items: footerItems,
          separator: " | ",
          includeSpacerBeforeFooter: fields.length > 0,
        }),
      );
    }

    return container;
  },
};

export default function (pi: ExtensionAPI) {
  pi.registerTool(repoTreeTool);
}
```
