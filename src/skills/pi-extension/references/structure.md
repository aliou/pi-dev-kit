# Extension Structure

This covers the standalone repository structure for a Pi extension. This is the recommended layout for new extensions.

## Directory Layout

```
my-extension/
  src/
    config.ts             # Config schema (types) + loader + defaults
    client.ts             # API client (if wrapping a third-party API)
    tools/
      index.ts            # Tool extension entry point (default export, calls pi.registerTool)
      actions/            # Optional one file per action for multi-action tools
        create.ts
        list.ts
        show.ts
      render.ts           # Optional separate render module
      types.ts            # Optional serialized types for tool details
    commands/
      index.ts            # Command extension entry point (default export, calls pi.registerCommand)
      components.ts       # Optional command UI components
    hooks/
      index.ts            # Hook extension entry point (default export, calls pi.on)
    components/           # Optional shared TUI components used by tools/commands/hooks
      my-component.ts
    providers/
      index.ts            # Provider extension entry point (default export, calls pi.registerProvider)
      models.ts           # Model definitions
    utils/                # Internal helpers (matching, parsing, etc.)
      my-helper.ts
  package.json
  tsconfig.json
  biome.json               # Linting/formatting
  shell.nix                # Nix dev environment
  .changeset/
    config.json            # Changeset config for versioning
  README.md
```

Not every extension needs every directory. A simple extension with one tool might only have `src/tools/index.ts` plus `src/config.ts` if it has settings.

### Organization principles

- **Each Pi feature directory is its own extension entry point.** `tools/index.ts`, `commands/index.ts`, `hooks/index.ts`, and `providers/index.ts` each export a default function that receives `ExtensionAPI` and registers that feature with `pi`.
- **`config.ts`** stays at root and is shared by feature entry points. Each entry point loads config and gates itself with `enabled` when applicable.
- **Do not use a single root `src/index.ts` that imports and registers everything.** Declare each feature entry point in `package.json` under `pi.extensions` instead.
- **Components are not entry points.** TUI components are support modules used by tools, commands, or hooks. Keep them colocated with the feature that uses them, or in `src/components/` only when genuinely shared.
- **Config types live in `config.ts`**, not a separate `types.ts` or `config-schema.ts`. The config file exports both the types (raw and resolved) and the config loader instance.
- **Utility/helper files** go in `utils/`. This includes pattern matching, shell parsing, event helpers, migrations, etc. Anything that is not a tool, command, component, provider, or hook.
- **No separate `types.ts`** unless the extension has shared types unrelated to config (rare). Config types are the most common shared types, and they belong in `config.ts`.
- **Multi-action tools** get their own directory under `tools/`. The tool registration + rendering lives in `index.ts`, each action gets its own file in `actions/`, and complex rendering logic goes in `render.ts`. Serialized types for tool details go in `types.ts`.
- **Core/domain logic** lives in dedicated modules at the `src/` root (`client.ts`, `manager.ts`). These contain the business logic, are testable without the Pi framework, and don't import from `@mariozechner/pi-coding-agent`. Tools are thin wrappers that call these modules and format results.

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
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": ">=CURRENT_VERSION",
    "@mariozechner/pi-ai": ">=CURRENT_VERSION",
    "@mariozechner/pi-tui": ">=CURRENT_VERSION",
    "typebox": ">=1.1.24"
  },
  "peerDependenciesMeta": {
    "@mariozechner/pi-coding-agent": { "optional": true },
    "@mariozechner/pi-ai": { "optional": true },
    "@mariozechner/pi-tui": { "optional": true },
    "typebox": { "optional": true }
  },
  "devDependencies": {
    "@aliou/biome-plugins": "^0.3.0",
    "@biomejs/biome": "^2.0.0",
    "@changesets/cli": "^2.27.0",
    "@mariozechner/pi-ai": "CURRENT_VERSION",
    "@mariozechner/pi-coding-agent": "CURRENT_VERSION",
    "@mariozechner/pi-tui": "CURRENT_VERSION",
    "typebox": "1.1.24",
    "@types/node": "^25.0.0",
    "husky": "^9.0.0",
    "typescript": "^5.8.0"
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
      "@mariozechner/pi-ai": "$@mariozechner/pi-coding-agent",
      "@mariozechner/pi-tui": "$@mariozechner/pi-coding-agent"
    }
  },
  "packageManager": "pnpm@10.26.1"
}
```

Replace `CURRENT_VERSION` with the actual installed version of pi (e.g., `0.70.0`).

Only include `pi` sub-fields that are actually used. `skills`, `themes`, `prompts`, and `video` are optional.

### Fields

**`pi` key**: Declares extension resources. All paths are relative to the package root.

| Field | Description |
|---|---|
| `extensions` | Array of extension entry point paths. Each file or directory `index.ts` exports a default function receiving `ExtensionAPI`. Prefer one entry point per feature directory (`tools/index.ts`, `commands/index.ts`, etc.). |
| `skills` | Array of directories containing skill definitions. Optional. |
| `themes` | Array of directories containing theme files. Optional. |
| `prompts` | Array of directories containing prompt files. Optional. |
| `video` | URL to an `.mp4` demo video. Displayed on the pi website package listing. Not used by pi itself. Optional. |

**`peerDependencies`**: Declares the minimum pi version required. Pi ships these packages and injects them via jiti at runtime, so extensions never need to install them:

- `@mariozechner/pi-coding-agent` — core types, utilities, and extension APIs
- `@mariozechner/pi-tui` — TUI components
- `@mariozechner/pi-ai` — AI utilities (`StringEnum`, etc.)
- `typebox` — TypeBox 1.x schema definitions for tool parameters and related types

List any of these you import at runtime in `peerDependencies` as optional peers. Pi 0.69+ uses `typebox` 1.x; do not import from `@sinclair/typebox` in new code. This prevents npm from installing duplicate copies when a user installs your extension. Use `>=` with the current version when creating.

**`peerDependenciesMeta`**: Marks peer dependencies as optional. Without `optional: true`, npm 7+ auto-installs peers that are not already present, which defeats the purpose — Pi already provides them.

**`devDependencies`**: Same packages at exact pinned versions for local type checking. `pnpm install` in your repo installs peerDependencies automatically, so local development is unaffected.

**`scripts.prepare`**: The `[ -d .git ] && husky || true` guard prevents husky from running in consumer environments (including when Pi installs your package). Without this, `husky` runs on every `npm install` and fails with a non-zero exit code in environments without a `.git` directory.

**`scripts.check:lockfile`**: Verifies the lockfile is in sync with `package.json`. Run in CI to catch accidental lockfile drift.

**`pnpm.overrides`**: Ensures pi sub-packages resolve to the version bundled with pi-coding-agent, avoiding duplicate installations.

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

Extensions are loaded directly by pi (no build step). `noEmit: true` means TypeScript is only used for type checking.

**Do not add `jsx` or `jsxImportSource` settings.** Although `src/components/` exists, pi-tui components are not React components. They implement the `Component` interface from `@mariozechner/pi-tui` and render to plain strings. No JSX transpilation is involved.

## biome.json

All extensions use Biome for linting and formatting. Canonical config:

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

The `plugins` field requires Biome 2.x for GritQL plugin support. The `@aliou/biome-plugins` package has five plugins; three apply to pi extensions:

- `no-inline-imports`: Disallows `await import()` and `require()` inside functions. All imports must be static.
- `no-js-import-extension`: Disallows `.js` extensions in import paths (enforces the rule in Critical Rules).
- `no-emojis`: Disallows emoji characters in code and strings.

The other two (`no-interpolated-classname`, `phosphor-icon-suffix`) are specific to React and Phosphor icons and are not applicable.

## config.ts

Non-trivial extensions have a `config.ts` that defines the config schema, types, and loader instance. Use plain TypeScript interfaces with a raw/resolved two-type pattern. The raw type has all fields optional — only overrides are stored to disk. The resolved type has all fields required — defaults are merged in at load time.

```typescript
import { ConfigLoader } from "@aliou/pi-utils-settings";

/**
 * Raw config shape (what gets saved to disk).
 * All fields optional -- only overrides are stored.
 */
export interface MyExtensionConfig {
  enabled?: boolean;
  myOption?: string;
}

/**
 * Resolved config (defaults merged in).
 * All fields required.
 */
export interface ResolvedMyExtensionConfig {
  enabled: boolean;
  myOption: string;
}

const DEFAULTS: ResolvedMyExtensionConfig = {
  enabled: true,
  myOption: "default-value",
};

/**
 * Config loader instance.
 * Config is stored at ~/.pi/agent/extensions/<name>.json
 */
export const configLoader = new ConfigLoader<
  MyExtensionConfig,
  ResolvedMyExtensionConfig
>("my-extension", DEFAULTS);
```

`ConfigLoader` comes from `@aliou/pi-utils-settings`, a standalone published package (source: `~/code/src/github.com/aliou/pi-extensions/packages/settings/`). It is listed as a regular dependency in `package.json`, not a peer dependency.

The name passed to `ConfigLoader` determines the filename: `"my-extension"` → `~/.pi/agent/extensions/my-extension.json`.

### Reading config

After calling `load()`, use `getConfig()` for the resolved config (defaults merged in) or `getRawConfig(scope)` for the raw config at a specific scope.

```typescript
await configLoader.load();
const config = configLoader.getConfig();        // ResolvedMyExtensionConfig
const raw = configLoader.getRawConfig("global"); // MyExtensionConfig | null
```

### Saving config

Use `save(scope, config)` to persist changes. The scope must be one of the enabled scopes (`"global"`, `"local"`, or `"memory"`). After saving, the loader automatically reloads and re-merges.

```typescript
await configLoader.save("global", { myOption: "new-value" });
// configLoader.getConfig() now reflects the saved change
```

Memory scope is ephemeral -- it resets on reload and is not written to disk.

### Scopes and merge order

Default scopes are `["global", "local"]`. Merge priority (lowest to highest): defaults -> global -> local -> memory. Only overrides are stored to disk; missing fields fall back to defaults.

For extensions with migrations or multi-scope config (global + local + in-memory), pass an options object:

```typescript
export const configLoader = new ConfigLoader<MyExtensionConfig, ResolvedMyExtensionConfig>(
  "my-extension",
  DEFAULTS,
  {
    scopes: ["global", "local", "memory"],
    migrations: [...],
  },
);
```

### Config Migrations

For evolving config shape across versions, pass named migrations to `ConfigLoader`:

```typescript
import { ConfigLoader, type Migration, buildSchemaUrl } from "@aliou/pi-utils-settings";
import pkg from "../package.json" with { type: "json" };

const legacyMigration: Migration<MyExtensionConfig> = {
  name: "legacy-flat-key-to-nested",
  shouldRun: (config) => Boolean(config.apiKey && !config.workspaces),
  run: (config) => {
    const migrated = structuredClone(config);
    migrated.workspaces = { default: { apiKey: config.apiKey } };
    delete migrated.apiKey;
    return migrated;
  },
};

const schemaUrl = buildSchemaUrl(pkg.name, pkg.version);

export const configLoader = new ConfigLoader<MyConfig, ResolvedMyConfig>(
  "my-extension",
  DEFAULTS,
  {
    schemaUrl,
    migrations: [legacyMigration],
  },
);
```

Each migration has:
- `name`: unique identifier for idempotency
- `shouldRun(config)`: predicate that returns true if migration is needed
- `run(config)`: returns the migrated config (must not mutate the input)

### JSON Schema for Config Validation

Use `buildSchemaUrl(pkg.name, pkg.version)` from `@aliou/pi-utils-settings` to generate a schema URL. Config files get a `$schema` field pointing to the published schema, enabling editor validation and autocompletion.

## Settings Command

Extensions with user-configurable settings use `registerSettingsCommand` from `@aliou/pi-utils-settings` to create a settings UI with Local/Global tabs:

```typescript
import { registerSettingsCommand, type SettingsSection } from "@aliou/pi-utils-settings";

registerSettingsCommand<MyConfig, ResolvedMyConfig>(pi, {
  commandName: "my-extension:settings",
  commandDescription: "Configure my extension",
  title: "My Extension Settings",
  configStore: configLoader,
  onSave: () => { /* invalidate caches */ },
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

For complex nested config (workspaces, profiles), use `submenu` fields with `SettingsDetailEditor` or `FuzzySelector` components. See `pi-linear/src/commands/settings.ts` for a full example.

### Auth Wizard

For extensions requiring API credentials, use the `Wizard` component from `@aliou/pi-utils-settings` for multi-step onboarding:

```typescript
import { Wizard, FuzzySelector, type WizardStepContext } from "@aliou/pi-utils-settings";

const wizard = new Wizard({
  title: "My Auth",
  theme,
  steps: [
    { label: "Key", build: (ctx) => new ApiKeyStep(state, ctx) },
    { label: "Validate", build: (ctx) => new ValidateStep(state, ctx) },
    { label: "Scope", build: (ctx) => new ScopeStep(state, ctx) },
  ],
  onComplete: async () => { /* save config */ },
  onCancel: () => done(false),
});
```

Each step receives a `WizardStepContext` with `markComplete()`/`markIncomplete()` to control navigation gates. See `pi-linear/src/commands/auth-wizard.ts` for a full example with async validation and spinner.

## Extension Entry Points

Each extension entry point is a default export function that receives the `ExtensionAPI` object. Do not centralize registration in one root `src/index.ts`; instead, make each feature directory an entry point and list those paths in `package.json` `pi.extensions`.

### Standard Pattern

```typescript
// src/tools/index.ts
import type { AgentToolResult, ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { defineTool } from "@mariozechner/pi-coding-agent";
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
  async execute(_toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult<MyToolDetails>> {
    const results = await search(params.query, { signal });
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
      details: { results },
    };
  },
});

export default async function (pi: ExtensionAPI) {
  await configLoader.load();
  const config = configLoader.getConfig();
  if (!config.enabled) return;

  pi.registerTool(myTool);
}
```

Declare the entry point directly:

```json
{
  "pi": {
    "extensions": ["./src/tools/index.ts"]
  }
}
```

For multiple features, list multiple entries:

```json
{
  "pi": {
    "extensions": [
      "./src/tools/index.ts",
      "./src/commands/index.ts",
      "./src/hooks/index.ts",
      "./src/providers/index.ts"
    ]
  }
}
```

### Acceptable Exceptions

Not all entry points follow the standard pattern exactly. These deviations are valid:

**No config**: Extensions that use environment variables exclusively and have no user-configurable settings skip config loading entirely. The entry point reads the env var directly and gates registration on its presence.

**API-key-first**: Extensions wrapping a third-party API check for the API key before loading config or registering anything. If the key is missing, notify the user and return early. Config loads after the key check. See the API Key Pattern section.

**No `enabled` check**: Extensions that are always active by design omit the `enabled` field and the early-return check. The entry point still loads config for other settings. Document this decision in `AGENTS.md`.

**Shared setup required**: If multiple feature entry points need a shared setup step, extract a helper module (for example `src/bootstrap.ts`) and call it from each entry. Do not reintroduce a central root entry point just to fan out registration.

When deviating from the standard pattern, note the reason in the extension's `AGENTS.md`.

## API Key Pattern

If your extension wraps a third-party API that requires an API key:

```typescript
export default function (pi: ExtensionAPI) {
  const apiKey = process.env.MY_API_KEY;

  // Register provider unconditionally if it exists
  // (provider handles missing key internally for model registration)
  pi.registerProvider(myProvider);

  // Only register tools that need the key
  if (!apiKey) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify("MY_API_KEY not set. Tools disabled.", "warning");
    });
    return;
  }

  pi.registerTool(createMyTool(apiKey));
  pi.registerCommand(createMyCommand(apiKey));
}
```

The principle: check for the API key before registering anything that requires it. If the extension also registers a provider, the provider can be registered regardless (it handles key presence internally for model listing).

## Imports

Do not use `.js` file extensions in imports. Use bare module paths:

```typescript
// Correct
import { myTool } from "./tools/my-tool";
import type { MyType } from "./types";

// Wrong
import { myTool } from "./tools/my-tool.js";
```

## Monorepo Variant

In a monorepo with pnpm workspaces, the structure differs slightly. There is no `src/` directory; the entry point and config live directly in the package root.

```
extensions/
  my-extension/
    index.ts              # Entry point (no src/ directory)
    config.ts             # Config schema (types) + loader + defaults
    commands/
      settings-command.ts
    hooks/
      my-hook.ts
    components/
      my-editor.ts
    utils/
      matching.ts
      shell-utils.ts
    package.json
```

Key differences from standalone:
- Entry point directly in the package root (no `src/` directory).
- `"pi": { "extensions": ["./index.ts"] }` instead of `["./src/index.ts"]`.
- Uses `peerDependencies` (resolved by workspace root).
- Shared `tsconfig` from a workspace package.
- Same organization principles apply: config types in `config.ts`, helpers in `utils/`, one directory per feature category.

### Workspace dependencies

When an extension depends on another workspace package (e.g., `@aliou/pi-utils-settings`, `@aliou/pi-agent-kit`), use the `workspace:^` protocol instead of a version range:

```json
{
  "dependencies": {
    "@aliou/pi-utils-settings": "workspace:^",
    "@aliou/sh": "^0.1.0"
  }
}
```

Use `workspace:^` only for packages that live in this monorepo (under `packages/` or `extensions/`). External published packages like `@aliou/sh` keep regular version ranges.
