# Additional APIs

This reference covers less common `ExtensionAPI`, `ExtensionContext`, and `ExtensionCommandContext` APIs.

## Shortcuts

Register keyboard shortcuts for interactive mode.

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "Toggle plan mode",
  handler: async (ctx) => {
    planModeEnabled = !planModeEnabled;
    ctx.ui.setStatus("plan-mode", planModeEnabled ? ctx.ui.theme.fg("accent", "Plan") : undefined);
  },
});
```

Shortcuts are TUI-only.

## Flags

Register CLI flags and read them in any handler.

```typescript
pi.registerFlag("plan", {
  description: "Start in plan mode",
  type: "boolean",
  default: false,
});

const planEnabled = pi.getFlag("plan") === true;
```

## Commands and Sessions

Command handlers receive `ExtensionCommandContext`, which adds session-control methods. These methods are command-only because they can deadlock from event handlers.

### Wait for idle

```typescript
pi.registerCommand("safe-command", {
  handler: async (_args, ctx) => {
    await ctx.waitForIdle();
    // Safe to inspect or replace session state.
  },
});
```

### New, fork, switch

Use `withSession` for post-replacement work. Captured old `pi`, old command `ctx`, and old `ctx.sessionManager` are stale after replacement.

```typescript
await ctx.newSession({
  setup: async (sm) => {
    sm.appendMessage({
      role: "user",
      content: [{ type: "text", text: "Seed context" }],
      timestamp: Date.now(),
    });
  },
  withSession: async (ctx) => {
    await ctx.sendUserMessage("Continue from the new session");
  },
});
```

```typescript
await ctx.fork(entryId, {
  position: "at",
  withSession: async (ctx) => ctx.ui.notify("Forked", "info"),
});

await ctx.switchSession(sessionPath, {
  withSession: async (ctx) => {
    await ctx.sendUserMessage("Resume this work here");
  },
});
```

### Tree navigation

```typescript
await ctx.navigateTree(targetId, {
  summarize: true,
  customInstructions: "Focus on implementation decisions",
  replaceInstructions: false,
  label: "review-checkpoint",
});
```

## Reload

Use `ctx.reload()` in command handlers. Treat it as terminal for predictable behavior.

```typescript
pi.registerCommand("reload-runtime", {
  description: "Reload extensions, skills, prompts, and themes",
  handler: async (_args, ctx) => {
    await ctx.reload();
    return;
  },
});
```

Code after `await ctx.reload()` still runs in the old call frame. Avoid post-reload work in that handler.

Tools cannot call `ctx.reload()`. If the LLM needs a reload tool, create a tool that queues a reload command as a follow-up user message.

```typescript
async execute() {
  pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
  return { content: [{ type: "text", text: "Queued /reload-runtime." }] };
}
```

## Sending Messages

### `pi.sendUserMessage(content, options?)`

Sends an actual user message and triggers a turn.

```typescript
pi.sendUserMessage("Summarize the current state.");
pi.sendUserMessage("Focus on tests next.", { deliverAs: "steer" });
pi.sendUserMessage("After that, summarize.", { deliverAs: "followUp" });
```

When the agent is streaming, specify `deliverAs: "steer"` or `"followUp"`.

### `pi.sendMessage(message, options?)`

Sends a custom message. Use `registerMessageRenderer` for custom display.

```typescript
pi.sendMessage(
  {
    customType: "my-extension-status",
    content: "Status update",
    display: true,
    details: { status: "ok" },
  },
  { deliverAs: "nextTurn" },
);
```

Delivery modes:

- `steer`: queue while streaming and deliver before next LLM call.
- `followUp`: wait until the agent finishes.
- `nextTurn`: save for the next user prompt.

## State and Session Metadata

```typescript
pi.appendEntry("my-extension-state", { enabled: true });
pi.setSessionName("Feature: auth refactor");
const name = pi.getSessionName();
pi.setLabel(entryId, "checkpoint-before-refactor");
pi.setLabel(entryId, undefined); // clear
```

Use labels for `/tree` bookmarks and session names for the session selector.

## Shell Execution

Use `pi.exec(command, args, options?)` for shell commands.

```typescript
const result = await pi.exec("git", ["status", "--porcelain"], {
  cwd: ctx.cwd,
  signal,
  timeout: 5_000,
});

// result.stdout, result.stderr, result.code, result.killed
```

Do not use Node `child_process` APIs for normal command execution. The only exception is a documented long-lived streaming process with direct stdin/stdout needs that `pi.exec()` cannot support.

## Active Tools

```typescript
const active = pi.getActiveTools();
const all = pi.getAllTools();
const builtin = all.filter((tool) => tool.sourceInfo.source === "builtin");

pi.setActiveTools(["read", "grep", "find"]);
```

`pi.getAllTools()` includes built-in tools, SDK tools, and extension tools with `sourceInfo` provenance.

## Model and Thinking Control

```typescript
const model = ctx.modelRegistry.find("anthropic", "claude-sonnet-4-5");
if (model) {
  const success = await pi.setModel(model);
  if (!success) ctx.ui.notify("No API key for this model", "error");
}

const level = pi.getThinkingLevel();
pi.setThinkingLevel("high");
```

Thinking levels are `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, and `"xhigh"`. Pi clamps unsupported levels to model capabilities.

## System Prompt Guidance

Prefer tool-level `promptSnippet` and `promptGuidelines` for simple guidance. Use `before_agent_start` only for dynamic or cross-tool guidance.

### Per-tool metadata

```typescript
const myTool = defineTool({
  name: "my_tool",
  label: "My Tool",
  description: "...",
  promptSnippet: "Manage background work without blocking the conversation.",
  promptGuidelines: [
    "Use my_tool for long-running commands instead of shell backgrounding.",
    "After starting my_tool, continue useful work instead of polling my_tool immediately.",
  ],
  parameters,
  async execute() {
    // ...
  },
});
```

Every `promptGuidelines` bullet must name the exact tool because Pi injects bullets flat into the global Guidelines section.

### System prompt hook

```typescript
export const MY_EXTENSION_GUIDANCE = `
## My Extension

Use \`my_tool\` when ...
Do not use bash workaround ...
`;

pi.on("before_agent_start", async (event) => {
  if (!configLoader.getConfig().systemPromptGuidance) return;
  return {
    systemPrompt: `${event.systemPrompt}\n\n${MY_EXTENSION_GUIDANCE}`,
  };
});
```

Use `event.systemPromptOptions` when you need structured prompt inputs such as selected tools, loaded skills, context files, and accumulated prompt guidelines.

## Compaction and Shutdown

Use `ctx.compact()` to trigger compaction without awaiting the full operation.

```typescript
ctx.compact({
  customInstructions: "Focus on recent code changes",
  onComplete: (result) => ctx.ui.notify("Compaction complete", "info"),
  onError: (error) => ctx.ui.notify(`Compaction failed: ${error.message}`, "error"),
});
```

Use `ctx.shutdown()` to request graceful shutdown.

```typescript
ctx.shutdown();
```

In interactive and RPC modes, shutdown is deferred until Pi becomes idle. In print mode it is a no-op.

## Event Bus

Use the shared event bus only when extensions need to coordinate.

```typescript
pi.events.emit("my-extension:data-ready", { items });
pi.events.on("my-extension:data-ready", (data) => {
  console.log(data.items.length);
});
```

Namespace event names with your extension name.

## UI Customization

### Working indicator and message

```typescript
ctx.ui.setWorkingMessage("Thinking through plan...");
ctx.ui.setWorkingMessage(); // restore default

ctx.ui.setWorkingVisible(false);
ctx.ui.setWorkingVisible(true);

ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("accent", "●")] });
ctx.ui.setWorkingIndicator({ frames: [] }); // hide indicator
ctx.ui.setWorkingIndicator(); // restore default
```

### Widgets, title, editor text

```typescript
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
ctx.ui.setWidget("my-widget", ["Below"], { placement: "belowEditor" });
ctx.ui.setWidget("my-widget", undefined);

ctx.ui.setTitle("pi - my project");
ctx.ui.setEditorText("Prefilled prompt");
const editorText = ctx.ui.getEditorText();
ctx.ui.pasteToEditor("Pasted content");
```

### Footer

```typescript
ctx.ui.setFooter((tui, theme, footerData) => ({
  invalidate() {},
  render(width) {
    return [theme.fg("dim", footerData.getGitBranch() ?? "no git")];
  },
  dispose: footerData.onBranchChange(() => tui.requestRender()),
}));

ctx.ui.setFooter(undefined);
```

### Autocomplete providers

Stack on top of the current provider and delegate when your syntax does not match.

```typescript
ctx.ui.addAutocompleteProvider((current) => ({
  async getSuggestions(lines, cursorLine, cursorCol, options) {
    const beforeCursor = (lines[cursorLine] ?? "").slice(0, cursorCol);
    const match = beforeCursor.match(/(?:^|[ \t])#([^\s#]*)$/);
    if (!match) return current.getSuggestions(lines, cursorLine, cursorCol, options);

    return {
      prefix: `#${match[1] ?? ""}`,
      items: [{ value: "#123", label: "#123", description: "Issue title" }],
    };
  },
  applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
    return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
  },
  shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
    return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
  },
}));
```

### Theme control

```typescript
const themes = ctx.ui.getAllThemes();
const light = ctx.ui.getTheme("light");
const result = ctx.ui.setTheme("light");
if (!result.success) ctx.ui.notify(result.error, "error");
```

## Pi Paths

Use SDK helpers for Pi paths instead of `homedir()` when helpers exist. They respect `PI_CODING_AGENT_DIR` and test/custom setups.

Common helpers exported from the main package include:

- `getAgentDir()`
- `getSettingsPath()`
- `getSessionsDir()`
- `getPromptsDir()`
- `getToolsDir()`
- `getCustomThemesDir()`
- `getModelsPath()`
- `getAuthPath()`
- `getBinDir()`
- `getDebugLogPath()`

## Checklist

- [ ] Session replacement code uses `withSession` for post-switch work.
- [ ] Reload handlers return immediately after `await ctx.reload()`.
- [ ] `pi.exec()` is used instead of `child_process`.
- [ ] System prompt changes return `{ systemPrompt }` from `before_agent_start`.
- [ ] `promptGuidelines` bullets name exact tools.
- [ ] UI customizations account for RPC/print degradation.
- [ ] Pi path helpers are used instead of `homedir()`.
