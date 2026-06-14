# Providers

Providers add or override LLM backends through `pi.registerProvider(name, config)`. Use them for proxies, custom endpoints, OAuth/SSO, and custom streaming APIs.

Read Pi `docs/custom-provider.md` and `docs/models.md` before implementing a provider.

## Quick Registration

```typescript
import type { ExtensionAPI, ProviderConfig } from "@earendil-works/pi-coding-agent";

const myProvider: ProviderConfig = {
  name: "My Provider",
  baseUrl: "https://api.example.com/v1",
  apiKey: "MY_API_KEY",
  api: "openai-completions",
  models: [
    {
      id: "my-model",
      name: "My Model",
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4096,
    },
  ],
};

export default function providersExtension(pi: ExtensionAPI) {
  pi.registerProvider("my-provider", myProvider);
}
```

Use `@earendil-works/*` imports in all new code.

## Async Model Discovery

If models come from a remote endpoint, fetch them in an async extension factory, not `session_start`. Pi waits for the factory before startup continues, so models are available during startup and `pi --list-models`.

```typescript
export default async function providersExtension(pi: ExtensionAPI) {
  const response = await fetch("http://localhost:1234/v1/models");
  const payload = (await response.json()) as {
    data: Array<{ id: string; name?: string; context_window?: number; max_tokens?: number }>;
  };

  pi.registerProvider("local-openai", {
    name: "Local OpenAI",
    baseUrl: "http://localhost:1234/v1",
    apiKey: "LOCAL_OPENAI_API_KEY",
    api: "openai-completions",
    models: payload.data.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.context_window ?? 128000,
      maxTokens: model.max_tokens ?? 4096,
    })),
  });
}
```

## Override Existing Providers

When only `baseUrl` and/or `headers` are provided, Pi keeps built-in models and auth.

```typescript
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com",
});

pi.registerProvider("openai", {
  headers: {
    "X-Custom-Header": "MY_HEADER_ENV_OR_LITERAL",
  },
});
```

## Unregister Providers

```typescript
pi.unregisterProvider("my-provider");
```

Unregistering removes dynamic models, API key fallback, OAuth registration, and stream handlers. Built-in behavior overridden by that provider is restored.

## ProviderConfig Fields

| Field | Notes |
|---|---|
| `name` | Display name for `/login` and UI. |
| `baseUrl` | Endpoint URL. Required when defining models. |
| `apiKey` | API key, env var name, or auth value. Required unless `oauth` handles auth. |
| `api` | API type. Required at provider or model level when defining models. |
| `headers` | Static custom headers. Values can be env var names. |
| `authHeader` | When `true`, Pi sends `Authorization: Bearer <key>`. |
| `models` | Replaces registered models for this provider when provided. |
| `oauth` | Adds `/login` support. |
| `streamSimple` | Custom streaming implementation for non-standard APIs. |

Supported API types include:

- `anthropic-messages`
- `openai-completions`
- `openai-responses`
- `azure-openai-responses`
- `openai-codex-responses`
- `mistral-conversations`
- `google-generative-ai`
- `google-vertex`
- `bedrock-converse-stream`

Prefer a built-in API type. Use `streamSimple` only when the upstream API cannot be adapted with config and compatibility flags.

## Model Fields

| Field | Required | Notes |
|---|---:|---|
| `id` | Yes | Model ID sent to the API. |
| `name` | Yes for provider extensions | Human-readable display name. |
| `api` | No | Model-level API override. |
| `baseUrl` | No | Model-level endpoint override. |
| `reasoning` | Yes | Whether extended thinking is supported. |
| `thinkingLevelMap` | No | Maps Pi thinking levels to provider-specific values; `null` hides unsupported levels. |
| `input` | Yes | `Array<"text" | "image">`. |
| `cost` | Yes | Per-million token cost: `{ input, output, cacheRead, cacheWrite }`. |
| `contextWindow` | Yes | Context window in tokens. |
| `maxTokens` | Yes | Maximum output tokens. |
| `headers` | No | Model-specific headers. |
| `compat` | No | Provider compatibility flags. |

### Thinking level map

Use model-level `thinkingLevelMap`; do not use older `compat.reasoningEffortMap`.

```typescript
{
  id: "custom-reasoner",
  name: "Custom Reasoner",
  reasoning: true,
  thinkingLevelMap: {
    minimal: null,
    low: null,
    medium: null,
    high: "default",
    xhigh: "max",
  },
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8192,
}
```

## Compatibility Flags

For OpenAI-compatible servers, use `compat` instead of custom streaming when possible.

```typescript
compat: {
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsUsageInStreaming: false,
  maxTokensField: "max_tokens",
  requiresToolResultName: true,
  thinkingFormat: "qwen-chat-template",
  cacheControlFormat: "anthropic",
}
```

Common flags:

- `supportsDeveloperRole`
- `supportsReasoningEffort`
- `supportsUsageInStreaming`
- `maxTokensField`
- `requiresToolResultName`
- `requiresAssistantAfterToolResult`
- `requiresThinkingAsText`
- `requiresReasoningContentOnAssistantMessages`
- `thinkingFormat`
- `cacheControlFormat`
- `supportsStrictMode`
- `supportsLongCacheRetention`
- `openRouterRouting`
- `vercelGatewayRouting`

For Anthropic-compatible proxies, check `supportsEagerToolInputStreaming` and `supportsLongCacheRetention` in Pi docs.

## OAuth Providers

OAuth integrates with `/login`.

```typescript
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";

pi.registerProvider("corporate-ai", {
  name: "Corporate AI",
  baseUrl: "https://ai.corp.com/v1",
  api: "openai-responses",
  models,
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
      callbacks.onAuth({ url: "https://sso.corp.com/authorize" });
      const code = await callbacks.onPrompt({ message: "Enter code:" });
      return exchangeCodeForTokens(code);
    },
    async refreshToken(credentials) {
      return refreshTokens(credentials.refresh);
    },
    getApiKey(credentials) {
      return credentials.access;
    },
    modifyModels(models, credentials) {
      return models;
    },
  },
});
```

Use `modifyModels` when subscription, tenant, or region information in credentials changes model endpoints or availability.

## API Key Gating

Provider registration and tool registration are separate.

- Register providers even when the API key is absent; Pi resolves auth and can show login/setup UI.
- Gate tools and commands that directly call the same API.

```typescript
export default function extension(pi: ExtensionAPI) {
  pi.registerProvider("my-provider", providerConfig);

  if (!process.env.MY_API_KEY) {
    pi.on("session_start", (_event, ctx) => {
      ctx.ui.notify("MY_API_KEY not set. my-provider tools disabled.", "warning");
    });
    return;
  }

  pi.registerTool(createSearchTool(process.env.MY_API_KEY));
}
```

Missing keys should disable affected tools gracefully, not crash extension loading.

## Custom Streaming

Use `streamSimple` only for non-standard APIs. Follow Pi provider implementations and tests.

Basic pattern:

```typescript
import {
  calculateCost,
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";

function streamMyProvider(model: Model<any>, context: Context, options?: SimpleStreamOptions) {
  const stream = createAssistantMessageEventStream();

  (async () => {
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    };

    try {
      stream.push({ type: "start", partial: output });
      // Push text/thinking/toolcall events as data arrives.
      calculateCost(model, output.usage);
      stream.push({ type: "done", reason: "stop", message: output });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();

  return stream;
}
```

Test custom providers against streaming, abort, usage, unicode, tool call, and context-overflow cases.

## Checklist

- [ ] Provider uses `pi.registerProvider(name, config)`.
- [ ] Dynamic model discovery happens in an async factory.
- [ ] Existing provider overrides do not redefine models unless needed.
- [ ] New models include current fields and `thinkingLevelMap` when relevant.
- [ ] Compatibility flags are used before custom streaming.
- [ ] OAuth providers implement login, refresh, getApiKey, and optional modifyModels.
- [ ] Tools needing the same credential are gated separately.
- [ ] Missing credentials produce a notification, not a crash.
