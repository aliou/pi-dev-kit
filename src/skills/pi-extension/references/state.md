# State Management

Prefer reconstructible state. Pi sessions can branch, fork, compact, reload, and resume; extension state must follow the active branch.

## Preferred Pattern: Tool Result `details`

When a tool changes state, return the latest snapshot in `details`. Rebuild in-memory state from the current branch on `session_start`.

```typescript
interface TodoState {
  items: Array<{ id: number; text: string; done: boolean }>;
  nextId: number;
}

export default function toolsExtension(pi: ExtensionAPI) {
  let state: TodoState = { items: [], nextId: 1 };

  pi.on("session_start", async (_event, ctx) => {
    state = { items: [], nextId: 1 };
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      if (entry.message.role !== "toolResult") continue;
      if (entry.message.toolName !== "todo") continue;

      const details = entry.message.details as Partial<TodoState> | undefined;
      if (details?.items && typeof details.nextId === "number") {
        state = { items: details.items, nextId: details.nextId };
      }
    }
  });

  const todoTool = defineTool({
    name: "todo",
    label: "Todo",
    description: "Manage session todos.",
    parameters,
    async execute(_toolCallId, params) {
      state.items.push({ id: state.nextId++, text: params.text, done: false });
      return {
        content: [{ type: "text", text: `Added todo: ${params.text}` }],
        details: { ...state },
      };
    },
  });

  pi.registerTool(todoTool);
}
```

Why this works:

- Forks and tree navigation naturally select different branches.
- Tool results are already ordered in session history.
- State is visible to renderers without separate storage.

## `appendEntry()`

Use `pi.appendEntry(customType, data)` for extension-specific state or audit entries that should persist but should not enter LLM context.

```typescript
pi.appendEntry("my-extension-state", {
  enabled: true,
  selectedProfile: "default",
});
```

Reconstruct from custom entries on `session_start` when the state is not tied to one tool result.

```typescript
pi.on("session_start", (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === "my-extension-state") {
      // Rebuild state from entry.data.
    }
  }
});
```

## `sendMessage()`

Use `pi.sendMessage()` for persistent user-visible messages that may be rendered with `registerMessageRenderer` and can enter model context depending on delivery.

```typescript
pi.sendMessage({
  customType: "my-extension-summary",
  content: "Summary text the LLM may see",
  display: true,
  details: { source: "quota-check" },
});
```

Do not use `sendMessage` for hidden internal state. Use tool `details` or `appendEntry`.

## Choosing a State Store

| Store | LLM sees | Branch-aware | Best for |
|---|---:|---:|---|
| Tool result `details` | No (`content` yes) | Yes | State caused by tool calls. |
| `appendEntry` | No | Yes if reconstructing from branch | Internal extension state/history. |
| `sendMessage` | Yes when delivered | Yes | Persistent user-visible context. |
| Config file | No | No | User settings, credentials, defaults. |
| In-memory only | No | No | Caches that can be rebuilt. |

## Compaction

Compaction may remove old detailed entries from active model context, but session history still exists. If state must survive compacted/forked workflows, keep reconstruction logic robust and consider adding summaries via custom messages only when the LLM needs that state.

## Guidelines

- Store snapshots, not deltas, unless replaying deltas is simple and reliable.
- Rebuild state from `ctx.sessionManager.getBranch()`, not from all entries, when branch behavior matters.
- Keep persisted `details` small and serializable.
- Do not store secrets in session entries.
- Reinitialize in-memory state on `session_start` and clean up resources on `session_shutdown`.
