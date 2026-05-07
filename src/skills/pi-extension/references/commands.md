# Commands

Commands are user-invoked actions triggered with `/command-name`. Register them with `pi.registerCommand(name, options)`.

## Registration

```typescript
pi.registerCommand("my-command", {
  description: "What this command does",
  handler: async (args, ctx) => {
    // args is the raw text after the command name.
    // ctx is ExtensionCommandContext.
  },
});
```

If several extensions register the same command, Pi keeps all of them and assigns invocation suffixes such as `/review:1` and `/review:2`.

## Argument Completion

Use `getArgumentCompletions` for command-specific autocomplete.

```typescript
import type { AutocompleteItem } from "@earendil-works/pi-tui";

pi.registerCommand("deploy", {
  description: "Deploy to an environment",
  getArgumentCompletions(prefix: string): AutocompleteItem[] | null {
    const items = ["dev", "staging", "prod"].map((env) => ({ value: env, label: env }));
    const filtered = items.filter((item) => item.value.startsWith(prefix));
    return filtered.length > 0 ? filtered : null;
  },
  handler: async (args, ctx) => {
    ctx.ui.notify(`Deploying ${args}`, "info");
  },
});
```

## Command Context

Command handlers receive `ExtensionCommandContext`, which includes normal `ExtensionContext` fields plus session-control methods.

Common fields and methods:

- `ctx.ui`, `ctx.hasUI`, `ctx.cwd`, `ctx.model`, `ctx.modelRegistry`, `ctx.sessionManager`, `ctx.signal`.
- `ctx.waitForIdle()`.
- `ctx.newSession({ setup, withSession })`.
- `ctx.fork(entryId, { position, withSession })`.
- `ctx.switchSession(path, { withSession })`.
- `ctx.navigateTree(targetId, options)`.
- `ctx.reload()`.

Session replacement invalidates captured old session-bound objects. Put post-switch work in `withSession` and use only that callback context.

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

Fire-and-forget UI calls such as `notify`, `setStatus`, and `setEditorText` are safe without `ctx.hasUI` guards.

## Parsing Arguments

`args` is a raw string. Parse it yourself.

```typescript
handler: async (args, ctx) => {
  const [subcommand, ...rest] = args.trim().split(/\s+/);
  const value = rest.join(" ");
}
```

For complex inputs, prefer a small parser over ad hoc indexing.

## Rich TUI Display

Use the three-tier pattern when a command uses `ctx.ui.custom()`.

```typescript
pi.registerCommand("quotas", {
  description: "Show API quotas",
  handler: async (_args, ctx) => {
    const quotas = await fetchQuotas();

    // Print/JSON mode: no UI.
    if (!ctx.hasUI) {
      console.log(formatQuotasPlain(quotas));
      return;
    }

    // Interactive mode: rich component. Use explicit sentinel, not undefined.
    const result = await ctx.ui.custom<"closed">((_tui, theme, _keybindings, done) => {
      return new QuotasDisplay(theme, quotas, () => done("closed"));
    });

    // RPC fallback: custom() returns undefined by design.
    if (result === undefined) {
      ctx.ui.notify(formatQuotasPlain(quotas), "info");
    }
  },
});
```

Do not call `done(undefined)` for normal interactive close paths if `result === undefined` detects RPC fallback.

## Commands That Trigger Agent Work

Use `pi.sendUserMessage()` when a command should queue a user message.

```typescript
pi.registerCommand("review-last", {
  description: "Ask Pi to review the last change",
  handler: async (_args, _ctx) => {
    pi.sendUserMessage("Review the last code change for correctness.");
  },
});
```

When calling during streaming, specify delivery mode:

```typescript
pi.sendUserMessage("Focus on tests next.", { deliverAs: "steer" });
pi.sendUserMessage("Then summarize.", { deliverAs: "followUp" });
```

## Reload Command

Treat reload as terminal.

```typescript
pi.registerCommand("reload-runtime", {
  description: "Reload extensions, skills, prompts, and themes",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

Do not perform post-reload work in the same handler; it is still running in the old call frame.

## Command vs Tool

| Aspect | Command | Tool |
|---|---|---|
| Invoked by | User or RPC `prompt` with `/name` | LLM during a turn |
| Purpose | User-facing action, setup, settings, display | Model capability |
| UI | User is usually present; still handle RPC/print | Must avoid surprising user prompts unless designed |
| Return | `Promise<void>` | `AgentToolResult` for the LLM |
| Session methods | Yes, command-only methods available | No session replacement methods |

If the LLM should use a capability autonomously, make it a tool. If the user intentionally invokes it, make it a command. Some features expose both: a command for setup/reload and a tool that queues that command as a follow-up.

## Component Extraction

Keep handlers thin. Extract rich components near the command that uses them.

```
src/commands/quotas.ts
src/commands/components/quotas-display.ts
```

Shared components can live in `src/components/`, but do not list component files in `pi.extensions`.

## Checklist

- [ ] Command has a clear description.
- [ ] Argument parsing handles empty input.
- [ ] `getArgumentCompletions` is used when arguments have known choices.
- [ ] Rich UI uses explicit sentinels and RPC/print fallback.
- [ ] Session replacement uses `withSession` for post-switch work.
- [ ] Reload command returns immediately after `ctx.reload()`.
- [ ] Long-running or cancellable work uses available abort signals.
