# Extension Structure

This is the recommended standalone repository layout for Pi extension packages.

## Directory Layout

```
my-extension/
  src/
    config.ts
    client.ts              # API/domain client, no Pi imports when possible
    manager.ts             # Core/domain logic, no Pi imports when possible
    tools/
      index.ts             # Tool entry point, default export registers tools
      actions/             # Optional action modules for multi-action tools
      render.ts            # Optional complex rendering
      types.ts             # Optional tool params/details types
    commands/
      index.ts             # Command entry point
      components/          # Command-specific TUI components
    hooks/
      index.ts             # Event hook entry point
    providers/
      index.ts             # Provider entry point
      models.ts
    components/            # Shared TUI components only when genuinely shared
    utils/                 # Parsing, matching, migrations, small helpers
  package.json
  tsconfig.json
  biome.json
  shell.nix
  .changeset/config.json
  README.md
```

Not every extension needs every directory. A one-tool extension can be `src/tools/index.ts` plus `src/config.ts`.

## Organization Rules

- Each feature directory is its own Pi entry point: `tools/index.ts`, `commands/index.ts`, `hooks/index.ts`, `providers/index.ts`.
- List those entry points directly in `package.json` `pi.extensions`.
- Avoid a root `src/index.ts` that imports and registers everything in new code.
- Keep `config.ts` at the root and shared by entry points.
- Keep config types in `config.ts`, not `types.ts`.
- Put domain logic in Pi-free modules such as `client.ts` and `manager.ts`; tools and commands should be thin wrappers.
- Components are support modules, not Pi entry points.
- Multi-action tools get a directory under `tools/`.
- Use `utils/` for generic helpers that are not tools, commands, hooks, providers, or components.

## Package Namespace

Pi core packages are migrating from `@mariozechner/*` to `@earendil-works/*`.

- Use `@earendil-works/*` once the target packages are published.
- Keep `@mariozechner/*` for projects that still target a legacy Pi package namespace.
- Do not mix namespaces unless you are intentionally doing a staged migration.

## package.json

```json
{
  "name": "@scope/pi-my-extension",
  "version": "0.1.0",
  "description": "Description of the extension",
  "type": "module",
  "license": "MIT",
  "private": false,
  "keywords": ["pi-package", "pi-extension", "pi"],
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/pi-my-extension"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": ["src", "README.md"],
  "pi": {
    "extensions": [
      "./src/tools/index.ts",
      "./src/commands/index.ts",
      "./src/hooks/index.ts",
      "./src/providers/index.ts"
    ],
    "skills": ["./skills"],
    "themes": ["./themes"],
    "prompts": ["./prompts"],
    "video": "https://example.com/demo.mp4"
  },
  "dependencies": {},
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-tui": "*",
    "typebox": "*"
  },
  "peerDependenciesMeta": {
    "@earendil-works/pi-coding-agent": { "optional": true },
    "@earendil-works/pi-ai": { "optional": true },
    "@earendil-works/pi-tui": { "optional": true },
    "typebox": { "optional": true }
  },
  "devDependencies": {
    "@biomejs/biome": "^2.3.0",
    "@changesets/cli": "^2.27.0",
    "@earendil-works/pi-ai": "CURRENT_VERSION",
    "@earendil-works/pi-coding-agent": "CURRENT_VERSION",
    "@earendil-works/pi-tui": "CURRENT_VERSION",
    "typebox": "1.1.24",
    "@types/node": "^25.0.0",
    "husky": "^9.0.0",
    "typescript": "^5.9.0"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "biome check",
    "format": "biome check --write",
    "check:lockfile": "pnpm install --frozen-lockfile --ignore-scripts",
    "prepare": "[ -d .git ] && husky || true",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "pnpm changeset publish"
  },
  "pnpm": {
    "overrides": {
      "@earendil-works/pi-ai": "$@earendil-works/pi-coding-agent",
      "@earendil-works/pi-tui": "$@earendil-works/pi-coding-agent"
    }
  },
  "packageManager": "pnpm@10.26.1"
}
```

Replace `CURRENT_VERSION` with the exact target Pi version for local type checking. If the target version is only available under the legacy namespace, use the matching `@mariozechner/*` package names consistently.

Only include `pi` sub-fields you actually use. `skills`, `themes`, `prompts`, `video`, and `image` are optional.

### Dependency Rules

Pi provides these runtime packages to extensions:

- `@earendil-works/pi-coding-agent` / legacy `@mariozechner/pi-coding-agent`
- `@earendil-works/pi-agent-core` / legacy `@mariozechner/pi-agent-core`
- `@earendil-works/pi-ai` / legacy `@mariozechner/pi-ai`
- `@earendil-works/pi-tui` / legacy `@mariozechner/pi-tui`
- `typebox`

For any of these that you import:

- Put them in `peerDependencies` with `"*"` by default.
- Use a minimum range such as `">=0.75.0"` only when code requires an API introduced after Pi 0.74.0, using the introducing version as the minimum.
- Mark them `optional: true` in `peerDependenciesMeta`.
- Put exact target versions in `devDependencies` for type checking.
- Do not bundle them.

Third-party runtime packages that Pi does not provide belong in `dependencies`. If bundling another Pi package's resources into your tarball, add it to `dependencies` and `bundledDependencies`, then reference resources through `node_modules/...` paths.

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

Pi loads TypeScript directly through jiti. No build step is needed. Do not add JSX settings; Pi TUI components are not React components.

## biome.json

Use Biome 2.x. If the project uses `@aliou/biome-plugins`, enable the Pi-relevant plugins.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.2/schema.json",
  "plugins": [
    "./node_modules/@aliou/biome-plugins/plugins/no-inline-imports.grit",
    "./node_modules/@aliou/biome-plugins/plugins/no-js-import-extension.grit",
    "./node_modules/@aliou/biome-plugins/plugins/no-emojis.grit"
  ],
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": ["**/*.ts", "**/*.json"],
    "ignoreUnknown": true
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

## Config Pattern

Use plain TypeScript interfaces with raw/resolved types. Do not use TypeBox for config types.

```typescript
import { ConfigLoader } from "@aliou/pi-utils-settings";

export interface MyExtensionConfig {
  enabled?: boolean;
  myOption?: string;
}

export interface ResolvedMyExtensionConfig {
  enabled: boolean;
  myOption: string;
}

const DEFAULTS: ResolvedMyExtensionConfig = {
  enabled: true,
  myOption: "default-value",
};

export const configLoader = new ConfigLoader<MyExtensionConfig, ResolvedMyExtensionConfig>(
  "my-extension",
  DEFAULTS,
);
```

After `await configLoader.load()`, use `configLoader.getConfig()` for resolved config and `getRawConfig(scope)` for a scope's raw overrides.

### Scopes and Migrations

```typescript
import { ConfigLoader, type Migration, buildSchemaUrl } from "@aliou/pi-utils-settings";
import pkg from "../package.json" with { type: "json" };

const migration: Migration<MyConfig> = {
  name: "legacy-key-to-workspaces",
  shouldRun: (config) => Boolean(config.apiKey && !config.workspaces),
  run: (config) => {
    const migrated = structuredClone(config);
    migrated.workspaces = { default: { apiKey: config.apiKey } };
    delete migrated.apiKey;
    return migrated;
  },
};

export const configLoader = new ConfigLoader<MyConfig, ResolvedMyConfig>(
  "my-extension",
  DEFAULTS,
  {
    scopes: ["global", "local", "memory"],
    schemaUrl: buildSchemaUrl(pkg.name, pkg.version),
    migrations: [migration],
  },
);
```

Migrations must be named, idempotent, and must not mutate their input.

## Settings Command

Use `registerSettingsCommand` from `@aliou/pi-utils-settings` for configurable extensions.

```typescript
import { registerSettingsCommand, type SettingsSection } from "@aliou/pi-utils-settings";

registerSettingsCommand<MyConfig, ResolvedMyConfig>(pi, {
  commandName: "my-extension:settings",
  commandDescription: "Configure my extension",
  title: "My Extension Settings",
  configStore: configLoader,
  onSave: () => {
    // Invalidate caches.
  },
  buildSections: (tabConfig, resolved, ctx): SettingsSection[] => [
    {
      label: "General",
      items: [
        {
          id: "enabled",
          label: "Enabled",
          description: "Enable or disable the extension",
          currentValue: (tabConfig?.enabled ?? resolved.enabled) ? "enabled" : "disabled",
          values: ["enabled", "disabled"],
        },
      ],
    },
  ],
});
```

For onboarding credentials, use the `Wizard` component from `@aliou/pi-utils-settings`.

## Entry Point Pattern

Each feature entry point loads config, checks `enabled`, then registers its feature.

```typescript
// src/tools/index.ts
import type { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";
import { configLoader } from "../config";

const parameters = Type.Object({
  query: Type.String({ description: "Search query" }),
});

type MyToolParams = Static<typeof parameters>;

interface MyToolDetails {
  results: string[];
}

const myTool = defineTool({
  name: "my_tool",
  label: "My Tool",
  description: "Search for items",
  parameters,
  async execute(_toolCallId, params, signal): Promise<AgentToolResult<MyToolDetails>> {
    const results = await search(params.query, { signal });
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
      details: { results },
    };
  },
});

export default async function toolsExtension(pi: ExtensionAPI) {
  await configLoader.load();
  const config = configLoader.getConfig();
  if (!config.enabled) return;

  pi.registerTool(myTool);
}
```

### Acceptable Deviations

Document deviations in `AGENTS.md`.

- **No config**: no user-configurable settings.
- **API-key-first**: check required API key before loading config or registering API-dependent features.
- **No enabled toggle**: extension is always active by design.
- **Shared bootstrap**: multiple entry points call a shared setup helper.

## API Key Pattern

```typescript
export default function toolsExtension(pi: ExtensionAPI) {
  const apiKey = process.env.MY_API_KEY;

  if (!apiKey) {
    pi.on("session_start", (_event, ctx) => {
      ctx.ui.notify("MY_API_KEY not set. my-extension tools disabled.", "warning");
    });
    return;
  }

  pi.registerTool(createMyTool(apiKey));
}
```

Providers are different: register providers even if a key may be absent, because Pi handles auth resolution and login UI.

## Imports

Do not use `.js` file extensions in TypeScript imports.

```typescript
// Correct
import { myTool } from "./tools/my-tool";

// Wrong
import { myTool } from "./tools/my-tool.js";
```

Do not use inline dynamic imports unless there is a documented reason.

## Monorepo Variant

In pnpm workspaces, package roots may not have `src/`.

```
extensions/my-extension/
  index.ts
  config.ts
  commands/
  hooks/
  components/
  package.json
```

Use workspace protocol only for local workspace packages.

```json
{
  "dependencies": {
    "@aliou/pi-utils-settings": "workspace:^",
    "@aliou/sh": "^0.1.0"
  }
}
```

Do not publish packages that depend on private workspace packages.

## Checklist

- [ ] One entry point per feature directory.
- [ ] No root fan-out registrar in new code.
- [ ] Pi core imports are optional peers with `"*"` unless a post-0.74.0 API requires a documented minimum range, and exact dev deps.
- [ ] Third-party runtime packages are in `dependencies`.
- [ ] Config uses raw/resolved TypeScript interfaces.
- [ ] Settings use `registerSettingsCommand` when configurable.
- [ ] API-key-missing path notifies and disables affected features.
- [ ] No `.js` suffixes in TypeScript imports.
