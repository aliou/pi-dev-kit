# Tools

Tools are functions the LLM can call. They are the primary way extensions add capabilities to pi.

## Registration

```typescript
import { Type, type ExtensionAPI, type ToolDefinition } from "@mariozechner/pi-coding-agent";

const myTool: ToolDefinition = {
  name: "my_tool",
  description: "What this tool does. The LLM reads this to decide when to call it.",
  parameters: Type.Object({
    query: Type.String({ description: "Search query" }),
    limit: Type.Optional(Type.Number({ description: "Max results", default: 10 })),
  }),
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    const results = await doSomething(params.query, params.limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      details: { results },
    };
  },
};

export default function (pi: ExtensionAPI) {
  pi.registerTool(myTool);
}
```

## Execute Signature

```typescript
execute(
  toolCallId: string,
  params: Static<TParams>,      // Typed from the parameters schema
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
  ctx: ExtensionContext,
): Promise<AgentToolResult<TDetails>>
```

**Parameter order matters.** The signal comes before onUpdate.

Always use optional chaining when calling `onUpdate`:

```typescript
onUpdate?.({ output: "partial result", details: { progress: 50 } });
```

The `onUpdate` parameter can be `undefined`. Calling it without optional chaining will throw.

## Tool Overrides and Delegation

If you override a built-in tool or wrap another tool, audit any delegated `tool.execute(...)` calls during upgrades. These forwarders often pass through `signal`, `onUpdate`, or `ctx` and can silently break when the execute signature changes. Always recheck the delegate call parameter order and include optional parameters that the target tool expects.

## Return Value

```typescript
return {
  content: (TextContent | ImageContent)[],  // Content blocks sent to the LLM
  details?: TDetails,                       // Arbitrary data available in the renderer
};
```

- `content` is what the LLM sees. Each block is `{ type: "text", text: "..." }` or an image. Keep it structured and concise.
- `details` is what the renderer sees. Put rich data here for custom display.

Common pattern:

```typescript
return {
  content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
  details: { results },
};
```

## Error Handling

To report a tool call failure, **throw an error**. The framework catches it, sets `isError: true` on the tool result, and sends the error message to the LLM.

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

Do not try to return `isError` in the result object. The `AgentToolResult` type does not have an `isError` field. Only throwing sets `isError: true` on the tool result event sent to the LLM.

### Error rendering in `renderResult`

When a tool throws, the framework still calls `renderResult`. It passes:
- `content`: an array with the error message as a text block
- `details`: an empty object `{}` (not `undefined`)

Your `renderResult` must detect this and display the error. Check for missing expected fields in `details` -- do not check `!details` since the framework always provides an object.

```typescript
// Full example: a tool that can fail, with proper error rendering.
import { ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@mariozechner/pi-coding-agent";

interface DivideDetails {
  result?: number;
}

const parameters = Type.Object({
  dividend: Type.Number({ description: "The number to divide" }),
  divisor: Type.Number({ description: "The number to divide by" }),
});

type DivideParams = Static<typeof parameters>;

const divideTool = {
  name: "divide",
  label: "Divide",
  description: "Divide two numbers.",
  parameters,

  async execute(
    _toolCallId: string,
    params: DivideParams,
    _signal: AbortSignal | undefined,
    _onUpdate: undefined,
    _ctx: ExtensionContext,
  ): Promise<AgentToolResult<DivideDetails>> {
    if (params.divisor === 0) {
      throw new Error("Division by zero");
    }
    const result = params.dividend / params.divisor;
    return {
      content: [{ type: "text", text: `${result}` }],
      details: { result },
    };
  },

  renderCall(args: DivideParams, theme: Theme) {
    return new ToolCallHeader(
      { toolName: "Divide", mainArg: `${args.dividend} / ${args.divisor}` },
      theme,
    );
  },

  renderResult(
    result: AgentToolResult<DivideDetails>,
    options: ToolRenderResultOptions,
    theme: Theme,
  ) {
    if (options.isPartial) {
      return new Text(theme.fg("muted", "Dividing..."), 0, 0);
    }

    const details = result.details;
    const container = new Container();

    // Detect error: details is {} when the tool threw.
    // Check for missing expected fields, not !details.
    if (details?.result === undefined) {
      const textBlock = result.content.find((c) => c.type === "text");
      const errorMsg =
        (textBlock?.type === "text" && textBlock.text) || "Division failed";
      container.addChild(new Text(theme.fg("error", errorMsg), 0, 0));
      return container;
    }

    container.addChild(
      new Text(theme.fg("success", `Result: ${details.result}`), 0, 0),
    );

    container.addChild(new Text("", 0, 0));
    container.addChild(
      new ToolFooter(theme, {
        items: [{ label: "result", value: `${details.result}` }],
        separator: " | ",
      }),
    );

    return container;
  },
};

export default function (pi: ExtensionAPI) {
  pi.registerTool(divideTool);
}
```

## Parameters Schema

Use TypeBox (`Type.*`) for parameter schemas. The LLM sees the schema to know what arguments to provide.

```typescript
import { Type } from "@mariozechner/pi-coding-agent";

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

```typescript
const myTool: ToolDefinition = {
  name: "my_tool",
  // ... parameters, execute ...

  renderCall(params, theme) {
    const header = [`My Tool: search`, JSON.stringify(params.query), `limit=${params.limit ?? 10}`].join(" ");
    return theme.fg("toolTitle", header);
  },

  renderResult(result, { expanded, isPartial }, theme) {
    if (isPartial) {
      return theme.fg("muted", "My Tool: running...");
    }

    const items: string[] = result.details?.results ?? [];
    const visible = expanded ? items : items.slice(0, 5);

    const lines = [
      theme.fg("success", `Found ${items.length} results`),
      ...visible.map((r) => `  ${r}`),
    ];

    if (!expanded && items.length > visible.length) {
      lines.push(theme.fg("dim", `  ...and ${items.length - visible.length} more`));
    }

    return lines.join("\n");
  },
};
```

`renderCall` receives the params the LLM passed and returns a string shown when the tool is invoked.

`renderResult` receives the result (with `details`) and rendering options:
- `expanded`: Whether the entry is expanded in the TUI.
- `isPartial`: Whether this is a streaming update (from `onUpdate`) or the final result.

Both return a string or undefined (falls back to default rendering).

## Tool UI Rendering Guidelines

When customizing tool rendering, keep call/result UI predictable and scannable.

### `renderCall` format

Use this line model:

- First line: `[Tool Name]: [Action] [Main arg] [Option args]`
- Additional lines: long args only

Guidelines:
- Tool name should be a human display label, not a raw internal identifier.
- Show `action` only when it adds meaning (multi-action tools like process managers).
- Main arg should be the primary thing user cares about (query, session id, target id/name).
- Option args should be compact key-value pairs (`limit=10`, `cwd=/path`).
- Long text (prompt/task/question/context/instructions) goes to additional lines.
- Prefer wrapping to preserve full meaning over aggressive truncation.
- For tools without actions, omit colon suffix after tool name if that reads better in your UI system.

### `renderCall` design guide (process-style)

The `process` extension is a good baseline (`../pi-processes/src/tools/index.ts`). Its call renderer is deterministic and keeps headers readable.

Use this extraction order when building header parts:

1. **Action first**: always show action for multi-action tools (`start`, `list`, `kill`, ...).
2. **Pick one main arg**: choose the single value the user scans for first (name, id, or short command).
3. **Promote short fields to options**: compact values become option args (`end=true`, `limit=10`).
4. **Demote long fields to long args**: commands/prompts/instructions move to labeled follow-up lines.
5. **Keep it stable**: same inputs should produce same ordering and formatting.

Implementation pattern:
- Build `mainArg`, `optionArgs`, `longArgs` first, then pass to one renderer.
- If you use `@aliou/pi-utils-ui`, prefer `ToolCallHeader` to avoid hand-built string drift.
- Quote user-provided names (`"backend"`) when that improves visual parsing.
- Cap inline length (e.g. 60-80 chars), then spill to `longArgs`.
### `renderResult` layout

- Handle `isPartial` first. Return a short stable loading state.
- Keep the first non-loading line as a status summary (`Found N results`, `Updated 3 files`, `Failed: reason`).
- Use `expanded` to switch between compact and full output. Compact should show the top few items plus an omission hint.
- Keep body content focused on state + key output; avoid dumping raw JSON unless it is the actual output.
- If you render a footer (stats, backend, counts), keep one blank line above it.
- Keep footer concise and stable across states.
- Return `undefined` when custom rendering adds no value; fallback rendering is better than noisy UI.

## Tool Call + UI Consistency Contract

Use this contract to keep tool UX consistent across extensions:

1. **Call line is for scanability**: `renderCall` first line follows `[Tool Name]: [Action] [Main arg] [Option args]`.
2. **Result starts with state**: `renderResult` starts with a clear state line (running/success/error) before details.
3. **Long text moves down**: prompts, instructions, and context go to follow-up lines, not the call header.
4. **Partial updates stay compact**: `isPartial` output should be short and stable to prevent visual churn.
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

For tools that may return large outputs, use the `truncateHead` utility:

```typescript
import { truncateHead } from "@mariozechner/pi-coding-agent";

execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  const fullOutput = await getLargeOutput();
  return {
    content: [{ type: "text", text: truncateHead(fullOutput, 50000) }], // Keep last 50KB
    details: {},
  };
},
```

`truncateHead` keeps the tail of the output (most recent content), which is usually most relevant.
