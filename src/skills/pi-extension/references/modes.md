# Mode Awareness

Pi extensions must behave correctly in Interactive, RPC, JSON, and Print modes.

## Modes

| Mode | `ctx.hasUI` | Notes |
|---|---:|---|
| Interactive | `true` | Full terminal UI. |
| RPC (`--mode rpc`) | `true` | Host handles dialogs through JSON protocol. TUI-only methods degrade. |
| JSON (`--mode json`) | `false` | Event stream to stdout; no extension UI. |
| Print (`-p`) | `false` | One-shot prompt; no extension UI. |

Important nuance: RPC has `ctx.hasUI === true` because dialog and fire-and-forget methods work through the extension UI protocol. But `ctx.ui.custom()` and other TUI-only methods do not work in RPC.

## Dialog Methods

These return values and may need mode-specific behavior.

| Method | Interactive | RPC | JSON/Print |
|---|---|---|---|
| `ctx.ui.select()` | TUI picker | JSON request to host | `undefined` |
| `ctx.ui.confirm()` | TUI dialog | JSON request to host | `false` |
| `ctx.ui.input()` | TUI input | JSON request to host | `undefined` |
| `ctx.ui.editor()` | TUI editor | JSON request to host | `undefined` |
| `ctx.ui.custom()` | Custom TUI component | `undefined` | `undefined` |

Check `ctx.hasUI` when a dialog gates behavior. If there is no UI, choose a safe default.

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (!isDangerous(event)) return;

  if (!ctx.hasUI) {
    return { block: true, reason: "Dangerous action blocked because no UI is available." };
  }

  const ok = await ctx.ui.confirm("Dangerous action", "Allow it?");
  if (!ok) return { block: true, reason: "Blocked by user" };
});
```

## Fire-and-Forget Methods

These are safe to call without guards. Unsupported modes ignore them or forward them to the RPC host.

| Method | Interactive | RPC | JSON/Print |
|---|---|---|---|
| `notify()` | TUI notification | JSON event | No-op |
| `setStatus()` | Footer status | JSON event | No-op |
| `setWidget()` string arrays | Widget | JSON event | No-op |
| `setTitle()` | Terminal title | JSON event | No-op |
| `setEditorText()` | Editor text | JSON event | No-op |
| `pasteToEditor()` | Paste handling | Set editor text | No-op |
| `setWorkingMessage()` | Loader text | No-op | No-op |
| `setWorkingVisible()` | Loader visibility | No-op | No-op |
| `setWorkingIndicator()` | Loader indicator | No-op | No-op |
| `setFooter()` | Custom footer | No-op | No-op |
| `setHeader()` | Custom header | No-op | No-op |
| `setEditorComponent()` | Custom editor | No-op | No-op |
| `setToolsExpanded()` | Tool expansion | No-op | No-op |
| Theme APIs | Full | Mostly unavailable | No-op/unavailable |

Component widgets are TUI-only; string-array widgets are portable to RPC.

## Three-Tier Pattern for `ctx.ui.custom()`

Use this for commands that display rich TUI components.

```typescript
pi.registerCommand("quotas", {
  description: "Show API quotas",
  handler: async (_args, ctx) => {
    const data = await fetchQuotas();

    // Tier 1: JSON/Print, no UI.
    if (!ctx.hasUI) {
      console.log(formatPlain(data));
      return;
    }

    // Tier 2: Interactive TUI. Use an explicit non-undefined sentinel.
    const result = await ctx.ui.custom<"closed">((_tui, theme, _keybindings, done) => {
      return new QuotasDisplay(theme, data, () => done("closed"));
    });

    // Tier 3: RPC. custom() returns undefined.
    if (result === undefined) {
      ctx.ui.notify(formatPlain(data), "info");
    }
  },
});
```

Do not use `done(undefined)` for normal interactive close paths when you use `result === undefined` as the RPC fallback detector. Use `null`, `false`, or a string sentinel.

## Fallback Choices

- Use `notify` for display-only results.
- Use `select` when the rich component is a picker.
- Use `confirm` when the rich component is a yes/no gate.
- Use `input`/`editor` when text entry is enough.
- Use `sendMessage` + `registerMessageRenderer` when output should persist in session history.
- Tell the user interactive mode is required when the UI cannot be reduced safely.

## Examples

### Selector fallback

```typescript
const result = await ctx.ui.custom<string | null>((_tui, _theme, _keybindings, done) => {
  return new FancyPicker(items, done); // done(value) or done(null)
});

if (result === undefined) {
  const selected = await ctx.ui.select("Pick an item", items.map((item) => item.label));
  // Handle selected.
}
```

### Confirmation fallback

```typescript
if (!ctx.hasUI) return { block: true, reason: "No UI to confirm" };

const proceed = await ctx.ui.custom<boolean | null>((_tui, theme, _keybindings, done) => {
  return new ConfirmDialog(theme, message, done); // done(true), done(false), or done(null)
});

if (proceed === undefined) {
  const confirmed = await ctx.ui.confirm("Allow action?", message);
  if (!confirmed) return { block: true, reason: "Blocked" };
} else if (proceed !== true) {
  return { block: true, reason: "Blocked" };
}
```

## Guidelines

1. Never assume interactive mode.
2. Fire-and-forget methods are safe without `ctx.hasUI` guards.
3. Guard dialogs that decide whether to proceed.
4. `ctx.ui.custom()` always needs fallback.
5. Use explicit sentinels instead of `done(undefined)`.
6. For security/safety gates, default to blocking when there is no UI.
7. Test interactive and print modes. Test RPC fallback for `custom()`.
