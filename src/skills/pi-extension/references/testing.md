# Testing

Pi loads extensions directly from TypeScript source (no build step). Testing is done by running pi with the extension loaded.

## Local Development

During development, the extension is loaded from the local filesystem. Point pi to your extension's `package.json` directory:

```bash
# From within the extension directory
pi
```

Pi reads the `pi.extensions` paths from `package.json` and loads the entry points.

## Type Checking

Run TypeScript type checking to catch errors without building:

```bash
pnpm tsc --noEmit
# or if configured in package.json:
pnpm typecheck
```

## Manual Testing Checklist

- [ ] Extension loads without errors.
- [ ] Tools appear in the tool list and work when called by the LLM.
- [ ] Commands appear in autocomplete and work when invoked.
- [ ] Custom renderers display correctly (both partial and final states).
- [ ] Missing API key shows a notification, not a crash.
- [ ] Works in Print mode (`pi -p "test message"`): no UI errors, graceful degradation.
- [ ] If using `ctx.ui.custom()`: RPC fallback is exercised (`custom()` returns undefined in RPC), and interactive close paths use explicit non-undefined sentinels (no accidental `done(undefined)` ambiguity).

## Testing Hooks

Test event hooks by triggering the relevant actions:

- `tool_call`: Have the LLM call a tool that your hook intercepts.
- `session_before_switch`: Create a new session or switch sessions.
- `input`: Type a message that matches your transform pattern.
- `before_agent_start`: Start any agent turn and verify system prompt modifications.

## Unit Testing Core Logic

The core/lib pattern makes domain logic testable without the Pi framework. Extract business logic into modules that don't import from `@mariozechner/pi-coding-agent` and test them directly.

### Testable core modules

```typescript
// src/manager.ts — no Pi imports
export class ProcessManager {
  start(name: string, command: string, cwd: string): ProcessInfo { ... }
  get(id: string): ProcessInfo | undefined { ... }
  kill(id: string): Promise<KillResult> { ... }
}
```

```typescript
// src/manager.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { ProcessManager } from "./manager";

describe("ProcessManager", () => {
  let manager: ProcessManager;
  afterEach(() => manager.cleanup());

  it("starts a process and returns info", () => {
    manager = new ProcessManager();
    const info = manager.start("test", "echo hello", "/tmp");
    expect(info.id).toMatch(/^proc_/);
    expect(info.name).toBe("test");
  });
});
```

### Testable execute functions

Export the execute logic as a pure function with injected dependencies:

```typescript
// src/tools/read-url.ts
export async function executeReadUrlRequest(
  input: string,
  signal: AbortSignal | undefined,
  handlers: ReadUrlHandler[],
  fetchImpl: FetchLike = fetch,
): Promise<ExecuteResult> {
  // all logic here, no Pi imports
}

// In the tool registration:
async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
  return executeReadUrlRequest(params.url, signal, handlers, fetch);
}
```

```typescript
// src/tools/read-url.test.ts
import { describe, it, expect } from "vitest";
import { executeReadUrlRequest } from "./read-url";

const mockHandler = {
  name: "mock",
  matches: (url: URL) => url.hostname === "example.com",
  fetchData: async () => ({ markdown: "# Hello", sourceUrl: "..." }),
};

describe("executeReadUrlRequest", () => {
  it("routes to matching handler", async () => {
    const result = await executeReadUrlRequest(
      "https://example.com/page",
      undefined,
      [mockHandler],
    );
    expect(result.details.handler).toBe("mock");
  });
});
```

### Handler pattern

For tools that route to different backends based on input, use an interface:

```typescript
export interface ReadUrlHandler {
  name: string;
  matches(url: URL): boolean;
  fetchData(url: URL, signal?: AbortSignal): Promise<HandlerResult>;
}
```

Multiple handlers are tried in order. Each handler is independently testable.

### Pi stub for hook testing

When testing hooks or tool registration, create a minimal Pi stub:

```typescript
function createPiStub() {
  const toolCallHandlers: Array<Parameters<ExtensionAPI["on"]>[1]> = [];
  const registeredTools: unknown[] = [];

  const pi = {
    on(eventName: string, handler: Parameters<ExtensionAPI["on"]>[1]) {
      if (eventName === "tool_call") toolCallHandlers.push(handler);
    },
    registerTool(tool: unknown) {
      registeredTools.push(tool);
    },
  } as unknown as ExtensionAPI;

  return { pi, toolCallHandlers, registeredTools };
}
```

### Test setup

Extensions use vitest. Add to `package.json`:

```json
{
  "devDependencies": {
    "vitest": "^3.2.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

## Debugging

Extension errors are logged to the pi log file. Check the output for stack traces:

```bash
# View pi logs
pi --log-level debug
```

If an extension fails to load, pi logs the error and continues without it.
