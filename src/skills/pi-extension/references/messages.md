# Messages

Pi provides several ways to display information to the user. Choose based on the UX goal.

## When to Use What

| Method | Persistence | Interactivity | Use When |
|---|---|---|---|
| `ctx.ui.notify()` | Transient (fades) | None | Quick feedback: "Saved", "API key missing" |
| `ctx.ui.custom()` | Until dismissed | Full keyboard | Rich interactive display: pickers, dashboards |
| `pi.sendMessage()` | In session history | Via renderer | Persistent results that should survive compaction |
| `pi.appendEntry()` | In session history | Via renderer | State tracking entries (see `references/state.md`) |

## sendMessage

Sends a message into the session conversation. It appears as an assistant message and is persisted in session history.

```typescript
pi.sendMessage({
  customType: "balance-result",     // Identifier for the message renderer
  content: "Balance: $42.50",       // Plain text content (LLM sees this)
  display: true,                    // Show in TUI
  details: { balance: 42.50 },     // Rich data for custom rendering
});
```

| Field | Type | Description |
|---|---|---|
| `customType` | `string` | Identifies the message type. Paired with `registerMessageRenderer`. |
| `content` | `string` | Plain text content. This is what the LLM sees if the message is in context. |
| `display` | `boolean` | Whether to show the message in the TUI. |
| `details` | `object` | Arbitrary data passed to the message renderer. |

## registerMessageRenderer

Registers a custom renderer for messages with a specific `customType`:

```typescript
import type {
  ExtensionAPI,
  MessageRenderOptions,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

interface BalanceDetails {
  balance?: number;
}

export default function (pi: ExtensionAPI) {
  pi.registerMessageRenderer<BalanceDetails>(
    "balance-result",
    (message, _options: MessageRenderOptions, theme: Theme) => {
      const balance = message.details?.balance;
      const text =
        typeof balance === "number"
          ? `Account Balance: $${balance.toFixed(2)}`
          : message.content;

      return new Text(theme.fg("success", text), 0, 0);
    },
  );
}
```

The renderer receives the full message object, render options, and theme. It returns a TUI `Component` such as `Text`, `Box`, `Markdown`, or a custom component. If no renderer is registered for a `customType`, the message's `content` field is displayed as plain text.

For larger renderers, keep the renderer implementation next to the hook or command that emits that `customType`. See `pi-processes/src/hooks/message-renderer.ts` for a compact lifecycle-message renderer and `pi-harness/extensions/breadcrumbs/lib/session-link.ts` for richer persistent session-link renderers.

## Custom Message Design Guide (breadcrumbs-style)

`breadcrumbs` is a good reference for custom entries/messages (`../pi-extensions/extensions/breadcrumbs/lib/session-link.ts`, plus `commands/handoff.ts` and `commands/spawn.ts`).

### 1) Prefer paired entries for links/handovers

For cross-session workflows, use two custom message types:
- **Marker** in source session: short line (`Handed off to X` / `Continues in X`).
- **Source** in new session: header + optional expanded context.

This gives both directions of navigation and keeps history readable.

### 2) Collapsed vs expanded behavior

Keep collapsed view minimal and scannable:
- one semantic line
- optional hint (`Press Ctrl+O to expand`) only when extra content exists

Use expanded view for rich content:
- markdown body
- multi-line context
- file lists / instructions

### 3) Renderer resilience

Message renderers should degrade safely:
- missing `details` => fallback to plain `content`
- markdown render failure => fallback to plain text
- unknown fields => ignore, don't throw

### 4) Keep details small and durable

`details` should contain stable identifiers and routing data, not large blobs:
- session IDs
- link type (`handoff`, `continue`)
- short metadata (goal/title)

Put large human-readable content in `content` (for expansion/LLM visibility), not deep nested `details`.

### 5) Use visual hierarchy consistently

For message UIs:
- muted label + accent target/value (`Continues in <session-name>`)
- subtle container background for custom message blocks
- avoid decorative noise; optimize for fast scan in session history

## Pattern: Command with sendMessage Fallback

This combines with the three-tier pattern from `references/modes.md`. Use `sendMessage` as the RPC fallback for commands that use `custom()`:

```typescript
// Register the renderer once at load time
pi.registerMessageRenderer("my-results", (message, theme) => {
  const { items } = message.details;
  return [
    theme.bold(`Results (${items.length})`),
    ...items.map((item: string) => `  ${theme.fg("accent", item)}`),
  ].join("\n");
});

pi.registerCommand("results", {
  description: "Show results",
  handler: async (_args, ctx) => {
    const items = await fetchItems();

    if (!ctx.hasUI) {
      console.log(items.join("\n"));
      return;
    }

    const result = await ctx.ui.custom<"closed">((tui, theme, _kb, done) => {
      return new ResultsDisplay(theme, items, () => done("closed"));
    });

    // RPC fallback only: custom() returns undefined in RPC/Print.
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

## notify

For transient feedback that does not need to persist:

```typescript
ctx.ui.notify("Operation complete", "info");
ctx.ui.notify("Something went wrong", "error");
ctx.ui.notify("Proceed with caution", "warning");
```

The second argument is the notification type: `"info"`, `"error"`, or `"warning"`. It affects the color/icon.

`notify` is fire-and-forget. It works in Interactive and RPC modes, and is a no-op in Print mode.

## Writing custom entries in a new session

When using `ctx.newSession({ setup })`, write custom entries directly through the setup `SessionManager`:

```typescript
await ctx.newSession({
  setup: async (sm) => {
    sm.appendCustomMessageEntry("my-source-type", "Context text", true, {
      parentSessionId: "...",
      linkType: "handoff",
    });
  },
});
```

Use this pattern for handoff/spawn-like workflows where the new session must start with structured context.
