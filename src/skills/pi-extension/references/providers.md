# Providers

Providers add LLM backends to pi. They connect pi to model APIs, proxies, gateways, and custom streaming implementations.

This reference tracks the current `pi.registerProvider(name, config)` API from pi-mono. For full provider details and advanced examples, also read pi-mono `packages/coding-agent/docs/custom-provider.md`.

## Registration

```typescript
import type { ExtensionAPI, ProviderConfig } from "@mariozechner/pi-coding-agent";

const myProviderConfig: ProviderConfig = {
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

export default function (pi: ExtensionAPI) {
  pi.registerProvider("my-provider", myProviderConfig);
}
```

## Common Registration Patterns

### Override an existing provider

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("anthropic", {
    baseUrl: "https://proxy.example.com",
  });
}
```

Use this when you want to keep the built-in provider and model list, but change the endpoint and/or headers.

### Register a new provider

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("my-provider", {
    baseUrl: "https://api.example.com/v1",
    apiKey: "MY_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "my-model",
        name: "My Model",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.5, output: 1.5, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ],
  });
}
```

### Unregister a provider

```typescript
pi.unregisterProvider("my-provider");
```

This takes effect immediately at runtime.

## ProviderConfig Fields

| Field | Type | Description |
|---|---|---|
| `baseUrl` | `string` | Base URL for the provider or proxy. |
| `headers` | `Record<string, string>` | Optional static headers to add to requests. |
| `apiKey` | `string` | Environment variable name containing the API key. |
| `api` | `"openai-completions" \| "openai-responses"` | Compatibility mode for request/response handling. |
| `models` | `ProviderModelConfig[]` | Model definitions exposed by this provider. |
| `streamSimple` | `function` | Optional custom streaming implementation for non-standard APIs. |
| `oauth` | `object` | Optional OAuth config for providers that need browser-based auth. |

Use the built-in OpenAI-compatible path when possible. Reach for `streamSimple` only when the upstream API is not compatible enough.

## Model Definition

The exact model type has more fields, but these are the ones you will usually need:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Model identifier within the provider config. |
| `name` | `string` | Display name shown in model selection UI. |
| `reasoning` | `boolean` | Whether the model is a reasoning model. |
| `input` | `Array<"text" \| "image" \| "audio" \| "pdf">` | Input modalities supported by the model. |
| `cost` | `object` | `{ input, output, cacheRead, cacheWrite }` cost values. |
| `contextWindow` | `number` | Maximum context window. |
| `maxTokens` | `number` | Maximum output tokens. |

## API Key Gating

Provider registration and extension tool registration are separate concerns.

For providers:
- Register the provider with `pi.registerProvider(name, config)`.
- Point `apiKey` at the environment variable name that holds the credential.
- If the provider should exist even when tools are disabled, still register it.

For tools and commands that require the same credential:
- Gate those registrations separately in your extension entry point.

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerProvider("my-provider", {
    baseUrl: "https://api.example.com/v1",
    apiKey: "MY_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "my-model",
        name: "My Model",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
    ],
  });

  if (!process.env.MY_API_KEY) return;

  pi.registerTool(mySearchTool);
  pi.registerCommand("quota", { handler: showQuota });
}
```

That pattern keeps provider setup accurate while still hiding tools that cannot work without credentials.

## When to read the upstream docs

Also read pi-mono `packages/coding-agent/docs/custom-provider.md` when you need:
- custom streaming via `streamSimple`
- OAuth support
- proxying existing providers
- header injection
- provider teardown with `pi.unregisterProvider()`
- advanced model config details
