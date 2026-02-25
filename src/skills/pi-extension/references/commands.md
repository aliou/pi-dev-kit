# Commands

Commands are user-invoked actions triggered with `/command-name` in the input editor.

## Registration

```typescript
pi.registerCommand("my-command", {
  description: "What this command does",
  handler: async (args, ctx) => {
    // args: string (everything after the command name)
    // ctx: ExtensionContext
  },
});
```

## Command Context

The `ctx` parameter provides the same `ExtensionContext` as hooks, with access to `ctx.ui`, `ctx.hasUI`, `ctx.cwd`, etc.

Commands are interactive by nature (the user typed them), so `ctx.hasUI` is usually `true`. However, commands can also be invoked programmatically (for example via RPC), so the three-tier pattern still applies.

## Simple Command

```typescript
pi.registerCommand("balance", {
  description: "Check API balance",
  handler: async (_args, ctx) => {
    const balance = await fetchBalance();
    ctx.ui.notify(`Balance: $${balance.toFixed(2)}`, "info");
  },
});
```

## Command with Rich Display

When a command needs a rich TUI display, use the three-tier pattern from `references/modes.md`:

```typescript
pi.registerCommand("quotas", {
  description: "Show API quotas",
  handler: async (_args, ctx) => {
    const quotas = await fetchQuotas();

    // Print mode
    if (!ctx.hasUI) {
      console.log(formatQuotasPlain(quotas));
      return;
    }

    // Interactive mode: full TUI component.
    // Use explicit sentinel value for close/cancel, not undefined.
    const result = await ctx.ui.custom<"closed">((tui, theme, _kb, done) => {
      return new QuotasDisplay(theme, quotas, () => done("closed"));
    });

    // RPC mode: custom() returns undefined by design.
    if (result === undefined) {
      ctx.ui.notify(formatQuotasPlain(quotas), "info");
    }
  },
});
```

Do not use `done(undefined)` in normal interactive close paths if you rely on `result === undefined` to detect RPC fallback.

## Extracting Components

Keep command handlers thin. Extract the TUI component into a separate file:

```
src/
  commands/
    quotas.ts              # Handler + formatQuotasPlain
  components/
    quotas-display.ts      # QuotasDisplay component class
```

The component file should export the component class. The command file imports it and wires up the handler.

## Arguments

The `args` parameter is the raw string after the command name. Parse it yourself:

```typescript
handler: async (args, ctx) => {
  const parts = args.trim().split(/\s+/);
  const subcommand = parts[0];
  // ...
},
```

## Command vs Tool

| Aspect | Command | Tool |
|---|---|---|
| Invoked by | User (typing `/name`) | LLM (during a turn) |
| Purpose | User-facing actions, settings, displays | LLM capabilities |
| UI access | Full (user is present) | Limited (LLM is driving) |
| Return value | void | `AgentToolResult` (output for LLM) |
