# Extension Structure

This is the recommended standalone repository layout for Pi extension packages using the multi-extension pattern.

## Directory Layout

```
my-extension/
  src/                       Pi-agnostic core (no @earendil-works/pi-* imports)
    config/                   Config types, defaults, loader, migrations
      types.ts                Raw + resolved config interfaces
      defaults.ts             DEFAULT_CONFIG
      loader.ts               ConfigLoader instance
      migration/
        index.ts              Named migrations + drainMigrationMessages()
      index.ts                Re-exports
    events.ts                 Event bus constants + payload types + creators (no Pi API)
    core/                     Domain logic, no Pi imports
    client.ts                 API/domain client, no Pi imports
    manager.ts                Core/domain logic, no Pi imports
    utils/                    Parsing, matching, small helpers

  extensions/                Pi-facing extension entry points (listed in package.json pi.extensions)
    my-domain/               Main extension: config, settings, feature discovery
      index.ts                Loads config, emits request events, registers settings
      commands/settings/      Settings command (my-domain:settings)
      hooks/                  Shared hooks
    feature-a/               Sub-extension (e.g. autocomplete, tools, providers)
      index.ts                Registers on request, listens for config updates
      provider.ts             Feature-specific implementation
      completion.ts           Helper functions

  package.json
  tsconfig.json
  biome.json
  shell.nix
  .changeset/config.json
  schema.json
  README.md
```

A minimal extension can be `extensions/my-domain/index.ts` plus `src/config/`. Not every extension needs sub-extensions.

## Existing Extensions

When modifying an existing extension that uses a different structure (e.g. flat `src/tools/`, `src/commands/`, single `src/config.ts`), preserve its current layout. Do not migrate to the multi-extension pattern unless the user explicitly asks. The patterns in this document are recommendations for new extensions, not a mandate to restructure working code.

## Organization Rules

- `src/` is Pi-agnostic: no imports from `@earendil-works/pi-*`. All Pi registration code lives under `extensions/`.
- Each entry in `extensions/` is its own Pi extension, listed in `package.json` `pi.extensions`.
- The main extension owns config loading, settings, feature discovery via the event bus.
- Sub-extensions (features) listen for the request event and register themselves.
- Keep config in `src/config/` with separate `types.ts`, `defaults.ts`, `loader.ts`, and `migration/`.
- Keep event bus constants and payload types in `src/events.ts` (no Pi API imports).
- Put domain logic in `src/core/` or Pi-free modules such as `client.ts` and `manager.ts`.
- Extensions are thin wrappers that call into core logic.
- Components are support modules under the extension that uses them, not Pi entry points.
- Multi-action tools get a directory under their extension.
- Use `src/utils/` for generic helpers that are not Pi-facing.

## Package Namespace

Pi core packages are `@earendil-works/*`.

- Always use `@earendil-works/*` in new code.
- The `@mariozechner/*` namespace is deprecated. Only keep legacy imports when the target version is not published under the new namespace.

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
  "files": ["src", "extensions", "schema.json", "README.md", "!src/**/*.test.ts", "!extensions/**/*.test.ts"],
  "pi": {
    "extensions": [
      "./extensions/my-domain/index.ts",
      "./extensions/feature-a/index.ts"
    ],
    "skills": ["./skills"],
    "themes": ["./themes"],
    "prompts": ["./prompts"],
    "video": "https://example.com/demo.mp4"
  },
  "dependencies": {
    "@aliou/pi-utils-settings": "^0.17.0",
    "@aliou/pi-utils-ui": "^0.4.0"
  },
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
    "@aliou/biome-plugins": "^0.10.0",
    "@biomejs/biome": "^2.5.0",
    "@changesets/cli": "^2.31.0",
    "@earendil-works/pi-ai": "CURRENT_VERSION",
    "@earendil-works/pi-coding-agent": "CURRENT_VERSION",
    "@earendil-works/pi-tui": "CURRENT_VERSION",
    "typebox": "^1.0.0",
    "ts-json-schema-generator": "^2.9.0",
    "@types/node": "^25.9.0",
    "husky": "^9.1.7",
    "typescript": "^5.9.3",
    "vitest": "^4.1.8"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "biome check",
    "format": "biome check --write",
    "gen:schema": "ts-json-schema-generator --path src/config/types.ts --type MyExtensionConfig --no-type-check -o schema.json",
    "check:schema": "ts-json-schema-generator --path src/config/types.ts --type MyExtensionConfig --no-type-check -o /tmp/schema-check.json && diff -q schema.json /tmp/schema-check.json",
    "test": "vitest run",
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

Replace `CURRENT_VERSION` with the exact target Pi version for local type checking.

Only include `pi` sub-fields you actually use. `skills`, `themes`, `prompts`, `video`, and `image` are optional.

### Dependency Rules

Pi provides these runtime packages to extensions:

- `@earendil-works/pi-coding-agent`
- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-tui`
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
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true
  },
  "include": ["src/**/*.ts", "extensions/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Pi loads TypeScript directly through jiti. No build step is needed. Do not add JSX settings; Pi TUI components are not React components.

The `include` must cover both `src/` and `extensions/`. The stricter options (`noUncheckedIndexedAccess`, etc.) catch common mistakes at compile time.

## biome.json

Use Biome 2.x. If the project uses `@aliou/biome-plugins`, enable the Pi-relevant plugins.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.0/schema.json",
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

Use plain TypeScript interfaces with raw/resolved types in `src/config/types.ts`. Do not use TypeBox for config types. Use per-feature nested config sections for granular toggles.

```typescript
// src/config/types.ts

/** Main extension settings. */
export interface MyDomainConfig {
  enabled?: boolean;
  myOption?: string;
}

/** Feature-A settings. */
export interface FeatureAConfig {
  enabled?: boolean;
}

/** User-facing configuration (all fields optional). */
export interface MyExtensionConfig {
  $schema?: string;
  myDomain?: MyDomainConfig;
  featureA?: FeatureAConfig;
}

/** Resolved configuration (defaults merged in, all fields required). */
export interface ResolvedMyExtensionConfig {
  myDomain: {
    enabled: boolean;
    myOption: string;
  };
  featureA: {
    enabled: boolean;
  };
}
```

```typescript
// src/config/defaults.ts

import type { ResolvedMyExtensionConfig } from "./types";

export const DEFAULT_CONFIG: ResolvedMyExtensionConfig = {
  myDomain: {
    enabled: true,
    myOption: "default-value",
  },
  featureA: {
    enabled: true,
  },
};
```

```typescript
// src/config/loader.ts

import { buildSchemaUrl, ConfigLoader } from "@aliou/pi-utils-settings";
import { DEFAULT_CONFIG } from "./defaults";
import { migrations } from "./migration";
import type { MyExtensionConfig, ResolvedMyExtensionConfig } from "./types";

const schemaUrl = buildSchemaUrl("@scope/pi-my-extension", "0.1.0");

export const configLoader = new ConfigLoader<MyExtensionConfig, ResolvedMyExtensionConfig>(
  "my-extension",
  DEFAULT_CONFIG,
  { migrations, schemaUrl },
);
```

```typescript
// src/config/index.ts

export { DEFAULT_CONFIG } from "./defaults";
export { configLoader } from "./loader";
export { drainMigrationMessages } from "./migration";
export type {
  MyDomainConfig,
  FeatureAConfig,
  MyExtensionConfig,
  ResolvedMyExtensionConfig,
} from "./types";
```

After `await configLoader.load()` (idempotent), use `configLoader.getConfig()` for resolved config and `getRawConfig(scope)` for a scope's raw overrides.

Generate `schema.json` from config types:

```bash
pnpm gen:schema   # ts-json-schema-generator --path src/config/types.ts --type MyExtensionConfig
pnpm check:schema # Verify schema.json is in sync
```

### Scopes and Migrations

Migrations live in `src/config/migration/index.ts`. Each migration has a unique name, a `shouldRun` predicate, and a `run` transform. They must be idempotent and must not mutate their input.

```typescript
// src/config/migration/index.ts

import type { Migration } from "@aliou/pi-utils-settings";
import type { MyExtensionConfig } from "../types";

const migrationMessages: string[] = [];

/** Drain and return any warning messages accumulated during config migration. */
export function drainMigrationMessages(): string[] {
  return migrationMessages.splice(0);
}

export const migrations: Migration<MyExtensionConfig>[] = [
  // Example: nest flat settings under domain key
  // {
  //   name: "nest-my-domain-settings",
  //   shouldRun: (config) => "enabled" in (config as MyExtensionConfig & { enabled?: boolean }),
  //   run: (config) => {
  //     const legacy = config as MyExtensionConfig & { enabled?: boolean; myOption?: string };
  //     const migrated: MyExtensionConfig = {
  //       ...config,
  //       myDomain: {
  //         ...config.myDomain,
  //         enabled: legacy.enabled,
  //         myOption: legacy.myOption,
  //       },
  //     };
  //     delete (migrated as MyExtensionConfig & { enabled?: boolean }).enabled;
  //     delete (migrated as MyExtensionConfig & { myOption?: string }).myOption;
  //     return migrated;
  //   },
  // },
];
```

The main extension surfaces migration warnings on `session_start`:

```typescript
const messages = drainMigrationMessages();
if (messages.length > 0) {
  ctx.ui.notify(["my-extension: config warnings:", ...messages.map((msg) => `- ${msg}`)].join("\n"), "warning");
}
```

## Event Bus Pattern

The main extension and sub-extensions communicate via three events defined in `src/events.ts`:

- `my-domain:feature:request` -- main emits on `session_start`, sub-extensions hear it and register.
- `my-domain:feature:register` -- sub-extensions emit with their feature ID.
- `my-domain:config:updated` -- main emits when settings change, sub-extensions listen.

```typescript
// src/events.ts

import type { ResolvedMyExtensionConfig } from "./config/types";

export type MyFeatureId = "featureA";

export const MY_DOMAIN_FEATURE_REQUEST_EVENT = "my-domain:feature:request" as const;
export const MY_DOMAIN_FEATURE_REGISTER_EVENT = "my-domain:feature:register" as const;
export const MY_DOMAIN_CONFIG_UPDATED_EVENT = "my-domain:config:updated" as const;

export interface MyFeatureRequestPayload {
  source: "my-domain";
  timestamp: string;
}

export interface MyFeatureRegisterPayload {
  source: "my-domain";
  timestamp: string;
  feature: { id: MyFeatureId };
}

export interface MyConfigUpdatedPayload {
  source: "my-domain";
  timestamp: string;
  config: ResolvedMyExtensionConfig;
}

function timestamp(): string {
  return new Date().toISOString();
}

export function createFeatureRequestPayload(): MyFeatureRequestPayload {
  return { source: "my-domain", timestamp: timestamp() };
}

export function createFeatureRegisterPayload(feature: MyFeatureId): MyFeatureRegisterPayload {
  return { source: "my-domain", timestamp: timestamp(), feature: { id: feature } };
}

export function createConfigUpdatedPayload(config: ResolvedMyExtensionConfig): MyConfigUpdatedPayload {
  return { source: "my-domain", timestamp: timestamp(), config };
}
```

## Settings Command

Use `registerSettingsCommand` from `@aliou/pi-utils-settings` for configurable extensions. Place the settings command under the main extension's `commands/settings/` directory.

```typescript
// extensions/my-domain/commands/settings/index.ts

import { registerSettingsCommand, type SettingsSection } from "@aliou/pi-utils-settings";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SettingItem } from "@earendil-works/pi-tui";
import {
  configLoader,
  type MyExtensionConfig,
  type ResolvedMyExtensionConfig,
} from "../../../../src/config";
import {
  MY_DOMAIN_CONFIG_UPDATED_EVENT,
  type MyFeatureId,
} from "../../../../src/events";

export function registerMyDomainSettings(pi: ExtensionAPI, options: { getLoadedFeatures: () => Set<MyFeatureId> }): void {
  registerSettingsCommand<MyExtensionConfig, ResolvedMyExtensionConfig>(pi, {
    commandName: "my-domain:settings",
    commandDescription: "Configure my extension settings",
    title: "My Extension Settings",
    configStore: configLoader,
    buildSections: (tabConfig, resolved): SettingsSection[] => [
      {
        label: "General",
        items: [
          {
            id: "enabled",
            label: "Enabled",
            description: "Enable or disable the extension",
            currentValue: (tabConfig?.myDomain?.enabled ?? resolved.myDomain.enabled) ? "on" : "off",
            values: ["on", "off"],
          },
        ],
      },
      {
        label: "Features",
        items: [
          featureRow("featureA", "Feature A", "Toggle feature A",
            tabConfig?.featureA?.enabled ?? resolved.featureA.enabled,
            options.getLoadedFeatures().has("featureA")),
        ],
      },
    ],
    onSettingChange: (id, newValue, config): MyExtensionConfig | null => {
      const updated = structuredClone(config);
      switch (id) {
        case "enabled":
          updated.myDomain = { ...updated.myDomain, enabled: newValue === "on" };
          return updated;
        case "featureA":
          updated.featureA = { ...updated.featureA, enabled: newValue === "enabled" };
          return updated;
        default:
          return null;
      }
    },
    onSave: async () => {
      pi.events.emit(MY_DOMAIN_CONFIG_UPDATED_EVENT, {
        source: "my-domain",
        timestamp: new Date().toISOString(),
        config: configLoader.getConfig(),
      });
    },
  });
}

function featureRow(id: string, label: string, description: string, configValue: boolean, isLoaded: boolean): SettingItem {
  if (isLoaded) {
    return { id, label, description, currentValue: configValue ? "enabled" : "disabled", values: ["enabled", "disabled"] };
  }
  return { id, label, description: `${description} (Not loaded by Pi)`, currentValue: "unavailable", values: [] };
}
```

For onboarding credentials, use the `Wizard` component from `@aliou/pi-utils-settings`.

## Entry Point Pattern

### Main Extension

The main extension owns config loading, settings, and the feature discovery event bus.

```typescript
// extensions/my-domain/index.ts

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { configLoader, drainMigrationMessages } from "../../src/config";
import {
  createFeatureRequestPayload,
  MY_DOMAIN_CONFIG_UPDATED_EVENT,
  MY_DOMAIN_FEATURE_REGISTER_EVENT,
  MY_DOMAIN_FEATURE_REQUEST_EVENT,
  type MyFeatureId,
} from "../../src/events";
import { registerMyDomainSettings } from "./commands/settings";
import { registerSessionStartHook } from "./hooks";

export default async function myDomainExtension(pi: ExtensionAPI) {
  await configLoader.load();

  const loadedFeatures = new Set<MyFeatureId>();

  // Listen for feature registrations from sub-extensions.
  pi.events.on(MY_DOMAIN_FEATURE_REGISTER_EVENT, (data: unknown) => {
    const payload = data as { feature: { id: MyFeatureId } };
    loadedFeatures.add(payload.feature.id);
  });

  // On session start, request feature registrations and emit config.
  pi.on("session_start", (_event, ctx) => {
    loadedFeatures.clear();
    pi.events.emit(MY_DOMAIN_FEATURE_REQUEST_EVENT, createFeatureRequestPayload());
    pi.events.emit(MY_DOMAIN_CONFIG_UPDATED_EVENT, {
      source: "my-domain",
      timestamp: new Date().toISOString(),
      config: configLoader.getConfig(),
    });

    // Surface migration warnings.
    const messages = drainMigrationMessages();
    if (messages.length > 0) {
      ctx.ui.notify(["my-domain: config warnings:", ...messages.map((msg) => `- ${msg}`)].join("\n"), "warning");
    }
  });

  registerMyDomainSettings(pi, { getLoadedFeatures: () => loadedFeatures });
  registerSessionStartHook(pi);
}
```

### Sub-Extension

Sub-extensions register with the main extension and react to config updates.

```typescript
// extensions/feature-a/index.ts

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { configLoader } from "../../src/config";
import {
  createFeatureRegisterPayload,
  MY_DOMAIN_CONFIG_UPDATED_EVENT,
  MY_DOMAIN_FEATURE_REGISTER_EVENT,
  MY_DOMAIN_FEATURE_REQUEST_EVENT,
  type MyConfigUpdatedPayload,
} from "../../src/events";

export default async function featureAExtension(pi: ExtensionAPI) {
  await configLoader.load();

  let enabled = configLoader.getConfig().featureA.enabled;

  function registerFeature(): void {
    pi.events.emit(MY_DOMAIN_FEATURE_REGISTER_EVENT, createFeatureRegisterPayload("featureA"));
  }

  registerFeature();
  pi.events.on(MY_DOMAIN_FEATURE_REQUEST_EVENT, registerFeature);

  // React to config changes from settings.
  pi.events.on(MY_DOMAIN_CONFIG_UPDATED_EVENT, (data: unknown) => {
    enabled = (data as MyConfigUpdatedPayload).config.featureA.enabled;
  });

  pi.on("session_start", (_event, ctx) => {
    if (!enabled) return;
    // Register tools, providers, etc.
  });
}
```

Sub-extensions call `await configLoader.load()` themselves (idempotent) and register their feature ID both at init time and in response to the request event.

### Acceptable Deviations

Document deviations in `AGENTS.md`.

- **No sub-extensions**: a single-extension package with one entry point.
- **No config**: no user-configurable settings.
- **API-key-first**: check required API key before loading config or registering API-dependent features.
- **No enabled toggle**: extension is always active by design.

## API Key Pattern

```typescript
export default function featureExtension(pi: ExtensionAPI) {
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

- [ ] One extension entry point per domain directory under `extensions/`.
- [ ] `src/` has no `@earendil-works/pi-*` imports.
- [ ] Config in `src/config/` with `types.ts`, `defaults.ts`, `loader.ts`, `migration/`.
- [ ] Event bus constants and payload types in `src/events.ts`.
- [ ] Main extension owns config loading, settings, and feature discovery.
- [ ] Sub-extensions register via event bus.
- [ ] Pi core imports are optional peers with `"*"` unless a post-0.74.0 API requires a documented minimum range, and exact dev deps.
- [ ] Third-party runtime packages are in `dependencies`.
- [ ] Settings use `registerSettingsCommand` when configurable.
- [ ] API-key-missing path notifies and disables affected features.
- [ ] No `.js` suffixes in TypeScript imports.
- [ ] `tsconfig.json` includes both `src/` and `extensions/`.
