# Hooks and Events

Hooks let extensions observe, modify, or block Pi lifecycle events. Register them with `pi.on(eventName, handler)`.

```typescript
pi.on("tool_call", async (event, ctx) => {
  // event is event-specific.
  // ctx is ExtensionContext.
});
```

Handlers run in extension load order. For blocking/cancelling events, the first blocking result wins.

## Event Lifecycle Summary

Common startup and prompt flow:

1. `session_start`
2. `resources_discover`
3. user input arrives
4. extension command check
5. `input`
6. skill/prompt expansion
7. `before_agent_start`
8. `agent_start`
9. repeated turns:
   - `turn_start`
   - `context`
   - `before_provider_request`
   - `after_provider_response`
   - message/tool lifecycle events
   - `turn_end`
10. `agent_end`
11. `session_shutdown` on exit, reload, or session replacement

Read Pi `docs/extensions.md` for the exhaustive event diagram before changing lifecycle-heavy code.

## Resource Events

### `resources_discover`

Contribute skill, prompt, and theme paths after startup or reload.

```typescript
pi.on("resources_discover", async (event) => {
  return {
    skillPaths: ["/path/to/skills"],
    promptPaths: ["/path/to/prompts"],
    themePaths: ["/path/to/themes"],
  };
});
```

`event.reason` is `"startup"` or `"reload"`.

## Session Events

| Event | Can cancel | Notes |
|---|---:|---|
| `session_start` | No | Session started, reloaded, resumed, or forked. |
| `session_before_switch` | Yes | Before `/new` or `/resume`. |
| `session_before_fork` | Yes | Before `/fork` or `/clone`; includes `position: "before" | "at"`. |
| `session_before_compact` | Yes/custom | Cancel or provide a custom compaction result. |
| `session_compact` | No | After compaction. |
| `session_before_tree` | Yes/custom | Before `/tree` navigation. |
| `session_tree` | No | After `/tree` navigation. |
| `session_shutdown` | No | Runtime teardown for quit, reload, new, resume, or fork. |

After a session replacement, the old runtime is torn down and extensions are rebound. Use `session_shutdown` for cleanup and `session_start` to rebuild in-memory state.

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  if (event.reason !== "new") return;
  if (!ctx.hasUI) return { cancel: true };

  const confirmed = await ctx.ui.confirm("Clear session?", "All messages will be lost.");
  if (!confirmed) return { cancel: true };
});
```

## Agent and Message Events

| Event | Purpose |
|---|---|
| `before_agent_start` | Inject a message or replace the system prompt for this turn. |
| `agent_start` / `agent_end` | Whole prompt lifecycle. |
| `turn_start` / `turn_end` | One provider response plus tool batch. |
| `context` | Modify copied messages before a provider call. |
| `message_start` / `message_update` / `message_end` | Observe or replace messages. |
| `before_provider_request` | Inspect/replace provider-specific payload. |
| `after_provider_response` | Inspect response status/headers before stream consumption. |
| `model_select` | Model changed. |
| `thinking_level_select` | Thinking level changed. |

### `before_agent_start`

Use this for system prompt changes that depend on dynamic context. Per-tool `promptSnippet` and `promptGuidelines` are preferred for simple tool-local guidance.

```typescript
pi.on("before_agent_start", async (event) => {
  return {
    systemPrompt: `${event.systemPrompt}\n\nExtra instructions for this turn.`,
  };
});
```

`event.systemPromptOptions` exposes structured prompt inputs such as selected tools, tool snippets, prompt guidelines, context files, and loaded skills. `ctx.getSystemPrompt()` reflects changes made by earlier `before_agent_start` handlers in the chain.

### `message_end`

`message_end` handlers can replace a finalized message. Keep the same role.

```typescript
pi.on("message_end", async (event) => {
  if (event.message.role !== "assistant") return;
  return {
    message: {
      ...event.message,
      usage: {
        ...event.message.usage,
        cost: { ...event.message.usage.cost, total: 0 },
      },
    },
  };
});
```

## Tool Events

| Event | Can block/modify | Notes |
|---|---:|---|
| `tool_execution_start` | No | Tool started. |
| `tool_call` | Block/mutate input | Runs before tool execution. |
| `tool_execution_update` | No | Partial result update. |
| `tool_result` | Modify result | Runs after tool execution, before final events. |
| `tool_execution_end` | No | Tool completed. |

Tool calls from one assistant message are preflighted sequentially, then run concurrently by default. Do not assume sibling tool results are visible inside `tool_call`.

### Blocking tool calls

Use `isToolCallEventType` for typed built-in inputs.

```typescript
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

pi.on("tool_call", async (event, ctx) => {
  if (!isToolCallEventType("bash", event)) return;

  if (!event.input.command.includes("rm -rf")) return;

  if (!ctx.hasUI) {
    return { block: true, reason: "Dangerous command blocked because no UI is available." };
  }

  const confirmed = await ctx.ui.confirm("Dangerous command", `Allow ${event.input.command}?`);
  if (!confirmed) return { block: true, reason: "Blocked by user" };
});
```

`event.input` is mutable. Mutating it changes the arguments passed to the tool. Pi does not revalidate after your mutation.

### Typing custom tool input

Export your custom tool input type and use explicit type params with `isToolCallEventType`.

```typescript
if (isToolCallEventType<"my_tool", MyToolParams>("my_tool", event)) {
  event.input.action;
}
```

### Modifying tool results

```typescript
pi.on("tool_result", async (event, ctx) => {
  if (event.toolName !== "bash") return;

  const response = await fetch("https://example.com/summarize", {
    method: "POST",
    body: JSON.stringify({ content: event.content }),
    signal: ctx.signal,
  });

  const summary = await response.text();
  return {
    content: [...event.content, { type: "text", text: `\nSummary: ${summary}` }],
  };
});
```

`tool_result` handlers chain like middleware. Return partial patches (`content`, `details`, `isError`) and omit fields that should stay unchanged.

## Input Events

`input` fires after extension command checks and before skill/template expansion. Return an action object.

```typescript
pi.on("input", async (event) => {
  if (event.source === "extension") return { action: "continue" };

  if (event.text.startsWith("?quick ")) {
    return {
      action: "transform",
      text: `Respond briefly: ${event.text.slice(7)}`,
      images: event.images,
    };
  }

  if (event.text === "ping") {
    return { action: "handled" };
  }

  return { action: "continue" };
});
```

Actions:

- `continue`: keep processing.
- `transform`: replace text/images, then continue.
- `handled`: stop; the extension handled the input.

Transforms chain across handlers. The first `handled` wins.

## User Bash Events

`user_bash` fires for user `!` and `!!` commands. It is separate from LLM bash tool calls.

Use it to provide custom bash operations or a direct result.

```typescript
import { createLocalBashOperations } from "@earendil-works/pi-coding-agent";

pi.on("user_bash", (event) => {
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      },
    },
  };
});
```

For transparent LLM bash tool rewriting, use a bash spawn hook instead.

## Bash Spawn Hook

`createBashTool(cwd, { spawnHook })` creates a bash tool that rewrites command/cwd/env before execution. Registering a tool named `bash` overrides the built-in bash tool.

```typescript
import { createBashTool, type BashSpawnContext } from "@earendil-works/pi-coding-agent";

export default function hooksExtension(pi: ExtensionAPI) {
  const bashTool = createBashTool(process.cwd(), {
    spawnHook: ({ command, cwd, env }: BashSpawnContext): BashSpawnContext => ({
      command: command.replace(/^npm /, "pnpm "),
      cwd,
      env: { ...env, CI: "1" },
    }),
  });

  pi.registerTool({ ...bashTool });
}
```

Use spawn hooks for clear rewrites or env injection. Use `tool_call` blocking for safety gates and confirmation dialogs.

Key points:

- Prompt metadata is not inherited when overriding built-ins. Re-declare `promptSnippet`/`promptGuidelines` if needed.
- Tool-call blockers run before the spawn hook.
- Prefer parsed shell rewrites over broad regex replacements.

## Provider Request Hooks

Use these for debugging serialization, proxies, or cache behavior.

```typescript
pi.on("before_provider_request", (event) => {
  console.log(JSON.stringify(event.payload, null, 2));
  // return { ...event.payload, temperature: 0 };
});

pi.on("after_provider_response", (event) => {
  if (event.status === 429) {
    console.log("rate limited", event.headers["retry-after"]);
  }
});
```

Payload-level rewrites are provider-specific and are not reflected by `ctx.getSystemPrompt()`.

## Mode Awareness

Dialog methods that gate behavior need a safe no-UI default. Fire-and-forget methods are safe without guards.

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (!shouldConfirm(event)) return;
  if (!ctx.hasUI) return { block: true, reason: "No UI to confirm" };

  const choice = await ctx.ui.select("Allow?", ["Allow", "Block"]);
  if (choice !== "Allow") return { block: true, reason: "Blocked" };
});
```

Read `references/modes.md` before adding UI to hooks.

## Checklist

- [ ] Event return shape matches current Pi docs.
- [ ] Blocking hooks have safe defaults when `ctx.hasUI` is false.
- [ ] `input` hooks return `{ action: ... }`, not raw strings.
- [ ] `before_agent_start` returns `{ systemPrompt }`; it does not call `ctx.setSystemPrompt()`.
- [ ] Nested async work uses `ctx.signal` when available.
- [ ] Session replacement cleanup/rebuild is split between `session_shutdown` and `session_start`.
- [ ] Built-in tool overrides re-declare prompt metadata if needed.
