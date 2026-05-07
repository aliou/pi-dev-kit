# Messages

Pi provides several ways to show information. Choose based on persistence and interactivity.

## When to Use What

| API | Persists | LLM context | Use when |
|---|---:|---:|---|
| `ctx.ui.notify()` | No | No | Quick feedback. |
| `ctx.ui.custom()` | No | No | Rich interactive display. |
| `pi.sendMessage()` | Yes | Yes when delivered into context | Persistent custom/user-visible messages. |
| `pi.appendEntry()` | Yes | No | Extension state/history that should not enter model context. |
| Tool result `details` | Yes | Details no; content yes | Branch-aware state tied to a tool call. |

For tool state, prefer tool result `details`. For command results that should be visible later, use `sendMessage` plus a renderer.

## `pi.sendMessage()`

Sends a custom message into the session.

```typescript
pi.sendMessage({
  customType: "balance-result",
  content: "Balance: $42.50",
  display: true,
  details: { balance: 42.5 },
});
```

Options:

```typescript
pi.sendMessage(message, { deliverAs: "steer", triggerTurn: true });
```

Delivery modes:

- `steer`: queue while streaming and deliver before the next LLM call.
- `followUp`: wait until the agent finishes.
- `nextTurn`: store for the next user prompt.

## `registerMessageRenderer`

Register a renderer for `customType`. Renderers return TUI `Component | undefined`.

```typescript
import type { ExtensionAPI, MessageRenderOptions, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

interface BalanceDetails {
  balance?: number;
}

export default function messagesExtension(pi: ExtensionAPI) {
  pi.registerMessageRenderer<BalanceDetails>("balance-result", (message, options, theme) => {
    const balance = message.details?.balance;
    const text =
      typeof balance === "number"
        ? `Account Balance: $${balance.toFixed(2)}`
        : message.content;

    return new Text(theme.fg("success", text), 0, 0);
  });
}
```

Renderer rules:

- Collapsed view should be one scannable line.
- Use `options.expanded` for details.
- If `details` is missing or malformed, fall back to `message.content`.
- Do not throw from renderers.
- Keep `details` small and durable; put large human-readable text in `content`.

## Command with Persistent Fallback

Use this when rich TUI output should persist for RPC users or future session readers.

```typescript
pi.registerMessageRenderer<{ items?: string[] }>("my-results", (message, options, theme) => {
  const items = message.details?.items;
  if (!items) return new Text(message.content, 0, 0);

  const visible = options.expanded ? items : items.slice(0, 5);
  return new Text(
    [
      theme.fg("accent", theme.bold(`Results (${items.length})`)),
      ...visible.map((item) => `  ${theme.fg("muted", item)}`),
    ].join("\n"),
    0,
    0,
  );
});

pi.registerCommand("results", {
  description: "Show results",
  handler: async (_args, ctx) => {
    const items = await fetchItems();

    if (!ctx.hasUI) {
      console.log(items.join("\n"));
      return;
    }

    const result = await ctx.ui.custom<"closed">((_tui, theme, _keybindings, done) => {
      return new ResultsDisplay(theme, items, () => done("closed"));
    });

    if (result === undefined) {
      pi.sendMessage({
        customType: "my-results",
        content: items.join("\n"),
        display: true,
        details: { items },
      });
    }
  },
});
```

## Notifications

Use for transient feedback.

```typescript
ctx.ui.notify("Operation complete", "info");
ctx.ui.notify("Something went wrong", "error");
ctx.ui.notify("Proceed with caution", "warning");
```

`notify` works in interactive and RPC modes and is a no-op in JSON/print.

## Custom Message Design

For session-link or handoff workflows, use paired messages:

- Source session marker: short line such as `Continues in <session>`.
- Destination session source: header plus optional expanded context.

Design rules:

- Collapsed message: one semantic line, optional expand hint only when details exist.
- Expanded message: markdown body, file lists, context, or routing details.
- Visual hierarchy: muted label, accent target/value, minimal decoration.
- Details: stable identifiers, link type, session IDs, short metadata.
- Content: user-readable text and anything the LLM may need.

## Writing Custom Entries in New Sessions

When using `ctx.newSession({ setup })`, write initial custom entries through the setup `SessionManager`.

```typescript
await ctx.newSession({
  setup: async (sm) => {
    sm.appendCustomMessageEntry("my-source-type", "Context text", true, {
      parentSessionId: "...",
      linkType: "handoff",
    });
  },
  withSession: async (ctx) => {
    await ctx.sendUserMessage("Continue from this handoff.");
  },
});
```

Use `withSession` for post-switch work.

## Checklist

- [ ] Picked the least persistent API that satisfies the UX.
- [ ] Custom message renderers return components and handle missing `details`.
- [ ] Collapsed message views are scannable.
- [ ] Large content is in `content`, not deeply nested `details`.
- [ ] `sendMessage` delivery mode is explicit when streaming behavior matters.
