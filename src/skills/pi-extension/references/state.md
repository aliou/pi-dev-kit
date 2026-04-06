# State Management

Extensions can persist state in the session history. In modern Pi extensions, the usual pattern is to store reconstructible state in tool result `details` and rebuild it from the current branch on `session_start`.

## Recommended Pattern: Store State in Tool Result Details

When a tool changes extension state, return the latest state in `details`. That keeps the state aligned with normal tool history, branching, and reconstruction.

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "todo") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "todo",
    // ...
    async execute() {
      items.push("Buy groceries");
      return {
        content: [{ type: "text", text: "Added todo item" }],
        details: { items: [...items] },
      };
    },
  });
}
```

## Reconstructing State from Session

When a session loads, reconstruct state in `session_start` by iterating over the current branch or full session through `ctx.sessionManager`:

```typescript
pi.on("session_start", async (_event, ctx) => {
  todoItems = [];

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "toolResult") {
      if (entry.message.toolName === "todo") {
        todoItems = entry.message.details?.items ?? [];
      }
    }
  }
});
```

This pattern makes state survive session reloads, forks, and compactions (as long as the entries are included in the compaction summary).

## When to Use appendEntry vs sendMessage

| | `appendEntry` | `sendMessage` |
|---|---|---|
| Rendered as | Tool call/result pair | Assistant message |
| Custom renderer | Tool's `renderResult` | `registerMessageRenderer` |
| Use for | State changes, action logs | Information display, command results |
| LLM sees | The `output` field | The `content` field |

Use tool result `details` when the state naturally belongs to a tool call and should follow normal conversation branching. Use `appendEntry` for extension-specific state/history that does not fit a normal tool result. Use `sendMessage` when you are displaying a one-time result.
