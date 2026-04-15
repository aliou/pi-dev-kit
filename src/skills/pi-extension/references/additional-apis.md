# Additional APIs

These APIs are available on `ExtensionAPI` and `ExtensionContext` but are less commonly used. Each is shown with a minimal example.

When you implement something using one of these APIs, update this skill reference with a fuller example based on your actual usage.

## Shortcuts

Register global keyboard shortcuts:

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "Toggle plan mode",
  handler: async (ctx) => {
    planModeEnabled = !planModeEnabled;
    ctx.ui.setStatus("plan", planModeEnabled ? "Plan Mode" : "");
  },
});
```

Shortcuts work only in Interactive mode.

## Flags

Register boolean flags that persist across sessions:

```typescript
// Register
pi.registerFlag("auto-commit", {
  description: "Auto-commit after each turn",
  default: false,
});

// Read (in any handler)
const autoCommit = pi.getFlag("auto-commit");
```

Users toggle flags with `/flag auto-commit` in the input editor.

## sendUserMessage

Inject a user message into the conversation programmatically:

```typescript
pi.sendUserMessage("Please summarize what we just discussed");
```

This triggers a full agent turn as if the user typed the message. Useful for file watchers, timers, or other automated triggers.

## Session Name

Set or get a name for the current session (shown in the session selector):

```typescript
pi.setSessionName("Feature: Auth Refactor");
const name = pi.getSessionName();
```

## Labels

Set a label on a specific session entry (shown in `/tree` view):

```typescript
pi.setLabel(entryId, "checkpoint: before refactor");
```

## exec

Run a shell command and get the result. This is the **only** way to run external binaries or shell scripts from an extension.

```typescript
const result = await pi.exec("git status --porcelain", { cwd: process.cwd() });
// result: { stdout, stderr, exitCode }
```

Useful for git operations, environment checks, running CLI tools, etc.

**Do not use Node `child_process` APIs** (`exec`, `execSync`, `spawn`, `spawnSync`, `execFile`, `execFileSync`). `pi.exec` handles CWD resolution, output capture, and integrates with the extension lifecycle. Using `child_process` directly bypasses these guarantees and creates inconsistent behavior across environments.

The only exception is a long-lived streaming process that requires direct stdin/stdout piping — document the reason in code comments if this applies.

## Active Tools

Get or set which tools are currently active:

```typescript
const tools = pi.getActiveTools(); // string[]
pi.setActiveTools(["bash", "read", "write", "my_custom_tool"]);
```

Setting active tools restricts which tools the LLM can use.

## Model Control

```typescript
// Set the active model
pi.setModel("anthropic/claude-sonnet-4-20250514");

// Get/set thinking level
const level = pi.getThinkingLevel(); // "none" | "low" | "medium" | "high"
pi.setThinkingLevel("high");
```

## System Prompt

Read or modify the system prompt (typically in `before_agent_start`):

```typescript
pi.on("before_agent_start", async (_event, ctx) => {
  const prompt = ctx.getSystemPrompt();
  ctx.setSystemPrompt(prompt + "\n\nExtra instructions.");
});
```

The system prompt resets each turn, so modifications are not cumulative.

### Guidance Injection Pattern

Extensions that add tools or behavioral patterns the agent may not know how to use correctly should inject guidance into the system prompt. Without it, agents fall back to bash workarounds even when a better tool is available.

**When to inject guidance:**
- Your extension adds a tool that competes with a natural bash fallback (e.g. a process manager, a CI watcher, a search tool)
- Correct usage depends on subtle conditions (alert flags, when-not-to-use, alert vs. poll)
- You have observed agents ignoring the tool or reaching for `bash` instead

**When not to:**
- The tool description alone is self-explanatory
- The tool has no plausible bash alternative

---

There are two ways to inject guidance, depending on complexity:

#### Tier 1: Per-Tool Metadata (Preferred for Simple Tools)

For most tools, use the SDK-level `promptSnippet` and `promptGuidelines` fields directly on the tool definition. No hook is needed.

- **`promptSnippet`** — Injected into the "Available tools" system prompt section. Use for a concise (1–2 sentence) description of when to prefer this tool.
- **`promptGuidelines`** — Appended verbatim to the global "Guidelines" section. Use for a short list of usage rules that still make sense without extra tool-local context.

```typescript
const myTool = {
  name: "my_tool",
  label: "My Tool",
  description: "...",
  promptSnippet: "Manage background processes without blocking the conversation.",
  promptGuidelines: [
    "Use my_tool for long-running commands instead of bash.",
    "After starting my_tool, continue other work instead of waiting.",
  ],
  parameters: ...,
  execute: ...,
};
```

This is the simplest approach and works well when guidance is specific to a single tool.

Because these bullets are merged into the shared global `Guidelines` section, avoid vague phrasing like `Use this tool...`. Name the exact tool (`my_tool`, `process`, `linkup_web_search`) so the bullet remains clear after injection.

#### Tier 2: System Prompt Hook (For Complex Cross-Tool Orchestration)

Use the `before_agent_start` hook when:
- Guidance involves **cross-tool workflow instructions** (e.g. "use tool A, then tool B, then tool C")
- You need **dynamic context from config** (e.g. workspace names, team keys, feature flags)
- The per-tool metadata fields aren't expressive enough

**Structure: three files**

`src/guidance.ts` — the guidance text as a named export:

```typescript
export const MY_EXTENSION_GUIDANCE = `
## My Extension

Use the \`my_tool\` tool for X. Don't use bash for X.

**Use \`my_tool\` when:**
- Situation A
- Situation B

**Use \`bash\` when:**
- You need the result immediately to proceed (quick commands that finish in seconds)

**Never do this:**
\`\`\`bash
workaround_command  # loses observability
\`\`\`

**Do this instead:**
\`\`\`
my_tool({ action: "start", ... })
\`\`\`
`;
```

`src/hooks/system-prompt.ts` — the hook:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { configLoader } from "../config";
import { MY_EXTENSION_GUIDANCE } from "../guidance";

export function registerGuidance(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event) => {
    const config = configLoader.getConfig();
    if (!config.systemPromptGuidance) return;

    return {
      systemPrompt: `${event.systemPrompt}\n${MY_EXTENSION_GUIDANCE}`,
    };
  });
}
```

`src/config.ts` — add the toggle (default `true`):

```typescript
export interface MyExtensionConfig {
  // ...
  /** Inject tool guidance into the system prompt each turn. Default: true. */
  systemPromptGuidance?: boolean;
}
```

Call `registerGuidance(pi)` from your hooks setup function.

---

**What makes guidance effective:**

- Lead with the decision rule: **when to use AND when not to use**. The when-not-to-use is as important — it gives the agent permission to keep using `bash` for quick tasks and prevents overcorrection.
- Name anti-patterns explicitly by their exact form (`cmd &`, `nohup`, `sleep 30 &&`). Abstract descriptions ("don't use bash workarounds") are ignored.
- Use 2–3 tight code examples. More than that dilutes attention; fewer leave the pattern underspecified.
- Keep the guidance section header (`## My Extension`) so it reads as a named capability, not a restriction.
- Avoid stacking emphasis markers (`NEVER`, `ALWAYS`, `IMPORTANT`). One or two land; more are ignored.

**Reference implementations:**
- `pi-linkup` — Uses per-tool `promptSnippet`/`promptGuidelines` (simple tools, no hook needed).
- `pi-linear` — Uses `guidance.ts` + `before_agent_start` hook (cross-tool workflow instructions + dynamic workspace context).
- `pi-processes` — Uses both: `promptSnippet`/`promptGuidelines` on tools for basic guidance, plus system prompt hook for complex multi-tool orchestration patterns.

## Compaction

Trigger compaction programmatically:

```typescript
await pi.compact();
```

## Shutdown

Shut down pi gracefully:

```typescript
pi.shutdown();
```

## EventBus

Inter-extension communication via a shared event bus:

```typescript
// Extension A: emit
pi.events.emit("my-extension:data-ready", { items: [...] });

// Extension B: listen
pi.events.on("my-extension:data-ready", (data) => {
  console.log("Received:", data.items.length, "items");
});
```

Namespace event names with your extension name to avoid collisions. The event bus is supplementary -- most extensions do not need it. Use it when two extensions need to coordinate.

## Theme Control

```typescript
// Get current and available themes
const current = ctx.ui.getTheme();
const all = ctx.ui.getAllThemes();

// Set theme
const result = ctx.ui.setTheme("catppuccin-mocha");
// result: { success: boolean, error?: string }
```

## UI Customization

```typescript
// Replace the footer
ctx.ui.setFooter((maxWidth, theme) => {
  return theme.fg("muted", "Custom footer content");
});

// Replace the startup header
ctx.ui.setHeader((maxWidth, theme) => {
  return theme.fg("accent", "My Custom Header");
});

// Set the editor component
ctx.ui.setEditorComponent((tui, theme, kb) => {
  return new CustomEditor(tui, theme, kb);
});

// Prefill the editor
ctx.ui.setEditorText("Prefilled content");
```
