# Mode Awareness

Pi runs in different modes. Extensions must handle all of them gracefully.

## Modes

| Mode | `ctx.hasUI` | Description |
|---|---|---|
| **Interactive** | `true` | Full TUI. Normal terminal usage. |
| **RPC** (`--mode rpc`) | `true` | JSON protocol. A host application handles UI. Dialogs work via request/response. |
| **Print** (`-p`, `--mode json`) | `false` | No UI. Extensions run but cannot prompt the user. |

Important nuance: in RPC mode, `ctx.hasUI` is `true`, but TUI-only APIs are degraded.

## Method Behavior by Mode

### Dialog Methods (return a value)

These methods prompt the user and return a result. Their behavior varies by mode.

| Method | Interactive | RPC | Print |
|---|---|---|---|
| `ctx.ui.select()` | TUI picker | JSON request to host | Returns `undefined` |
| `ctx.ui.confirm()` | TUI dialog | JSON request to host | Returns `false` |
| `ctx.ui.input()` | TUI text input | JSON request to host | Returns `undefined` |
| `ctx.ui.editor()` | TUI editor | JSON request to host | Returns `undefined` |
| `ctx.ui.custom()` | TUI component | Returns `undefined` | Returns `undefined` |

Key observation: `custom()` returns `undefined` in both RPC and Print modes. All other dialog methods work in RPC (the host presents them to the user).

Second key observation: `custom()` can also resolve to `undefined` in Interactive mode if your component calls `done(undefined)`. So `result === undefined` is not a reliable mode detector by itself.

### Fire-and-Forget Methods (no return value)

These methods are safe to call unconditionally in any mode. In modes that do not support them, they are silently ignored.

| Method | Interactive | RPC | Print |
|---|---|---|---|
| `ctx.ui.notify()` | TUI notification | JSON event to host | No-op |
| `ctx.ui.setStatus()` | Status bar | JSON event to host | No-op |
| `ctx.ui.setWidget()` | Widget area | JSON event to host (string arrays only) | No-op |
| `ctx.ui.setTitle()` | Window title | JSON event to host | No-op |
| `ctx.ui.setEditorText()` | Sets editor content | JSON event to host | No-op |
| `ctx.ui.setFooter()` | Footer area | No-op | No-op |
| `ctx.ui.setHeader()` | Header area | No-op | No-op |
| `ctx.ui.setWorkingMessage()` | Loader text | No-op | No-op |
| `ctx.ui.setEditorComponent()` | Custom editor | No-op | No-op |

You never need to check `ctx.hasUI` before calling fire-and-forget methods.

## When to Check ctx.hasUI

Check `ctx.hasUI` when a dialog method gates behavior. If the dialog result determines what happens next (for example, blocking a tool call or cancelling a session switch), you must handle the case where the dialog cannot run.

```typescript
// tool_call handler: must decide to block or allow
pi.on("tool_call", async (event, ctx) => {
  if (isDangerous(event)) {
    if (!ctx.hasUI) {
      // Print mode: no way to ask the user, block by default
      return { block: true, reason: "Dangerous command blocked (no UI)" };
    }

    const choice = await ctx.ui.select("Dangerous command detected", ["Allow", "Block"]);
    if (choice !== "Allow") {
      return { block: true, reason: "Blocked by user" };
    }
  }
  return undefined;
});
```

You do not need to check `ctx.hasUI` for:
- Fire-and-forget calls (`notify`, `setStatus`, `setWidget`, etc.).
- Dialogs where the default return value is acceptable (for example, a non-critical confirm that defaults to `false`).

## The Three-Tier Pattern for Custom Components

When a command uses `ctx.ui.custom()` for a rich TUI display, handle three tiers:

```typescript
pi.registerCommand("quotas", {
  description: "Show API quotas",
  handler: async (_args, ctx) => {
    const data = await fetchQuotas();

    // Tier 1: Print mode -- no UI at all
    if (!ctx.hasUI) {
      console.log(formatPlain(data));
      return;
    }

    // Tier 2: Interactive mode -- full TUI component.
    // Use an explicit non-undefined sentinel for close/cancel.
    const result = await ctx.ui.custom<"closed">((tui, theme, _kb, done) => {
      return new QuotasDisplay(theme, data, () => done("closed"));
    });

    // Tier 3: RPC mode -- custom() returns undefined by design.
    if (result === undefined) {
      ctx.ui.notify(formatPlain(data), "info");
    }
  },
});
```

Since `select`, `confirm`, `input`, and `notify` all work in RPC mode (forwarded to the host via JSON protocol), use them as the RPC fallback. Choose based on UX:

- **`notify`**: Transient feedback or displaying data. Best for most display-only commands.
- **`select`**: When the custom component is a picker/selector. The RPC host presents a list.
- **`confirm`**: When the custom component is a confirmation dialog (for example, permission gate).
- **Notify "requires interactive mode"**: When the custom component is too complex to reduce (for example, settings editor, process manager).

Use `sendMessage` + `registerMessageRenderer` only when the result must persist in session history. See `references/messages.md`.

### Example: Selector Fallback

```typescript
const result = await ctx.ui.custom<string | null>((_tui, _theme, _kb, done) => {
  return new FancyPicker(items, done); // done(value) or done(null)
});

// RPC fallback: use select dialog
if (result === undefined) {
  const selected = await ctx.ui.select("Pick an item", items.map((i) => i.label));
  // ... handle selected
}
```

### Example: Confirmation Fallback

```typescript
// In a tool_call handler:
if (!ctx.hasUI) {
  return { block: true, reason: "No UI to confirm" };
}

const proceed = await ctx.ui.custom<boolean>((_tui, theme, _kb, done) => {
  return new ConfirmDialog(theme, message, done); // done(true|false)
});

// RPC fallback: custom() returns undefined, so treat as "not approved".
if (proceed !== true) {
  return { block: true, reason: "Blocked" };
}
```

## Guidelines

1. Never assume Interactive mode. Always consider what happens in RPC and Print.
2. Fire-and-forget methods are always safe. Use them freely.
3. Guard dialog methods that gate behavior with `ctx.hasUI` checks.
4. Always provide a fallback for `ctx.ui.custom()` because it returns `undefined` in RPC and Print.
5. Do not use `done(undefined)` for normal interactive close paths if you need to detect RPC fallback.
6. For `tool_call` handlers, decide a safe default when there is no UI (usually block).
7. Test your extension in at least Interactive and Print modes. If you use `custom()`, test RPC fallback explicitly.
