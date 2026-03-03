---
name: demo-setup
description: Set up demo environments for Pi extensions to record videos or screenshots for the Pi package browser. Use when preparing a demo, recording a video, or creating preview assets for an extension or theme.
---

# Demo Setup

Set up self-contained demo directories for Pi extensions. The demo directory contains everything needed to showcase an extension: a prompt that runs through the features, fixture files, and pi configuration.

## Pi Package Browser

The Pi website has a package browser at `buildwithpi.ai/packages`. Packages can display preview media.

### Adding Preview Media to package.json

```json
{
  "pi": {
    "extensions": ["./index.ts"],
    "video": "https://example.com/demo.mp4",
    "image": "https://example.com/preview.png"
  }
}
```

Both `video` and `image` are optional. Video takes precedence when present.

### Video/Image Specs

- **Aspect ratio**: 16:9 (enforced by `aspect-ratio: 16/9` CSS)
- **Recommended resolution**: 1920x1080
- **Object fit**: `contain` on black background
- **Modal max width**: 900px
- **Format**: `.mp4` for video, `.png`/`.jpg`/`.jpeg`/`.webp`/`.gif` for image
- **Caching**: Client-side localStorage, 15-minute TTL. New visitors or cleared cache see updates immediately.

### For Themes

Themes show better as images (screenshots of dark and light variants side by side). A single 16:9 image with both variants is ideal.

## Northwind Base Project

Northwind is a fictive Node.js REST API project used as the base environment for demos. It provides a realistic project structure with shell scripts, config files, and database workflows that extensions can hook into.

Use Northwind when the demo needs a project context. Customize it freely -- add files, remove scripts, tweak behavior to highlight the extension's features. Northwind is a starting point, not a rigid template.

### Project context

Northwind is a trading company API with:
- Customers, products, orders, categories, suppliers
- PostgreSQL database with migrations and seed data
- A "shipping address" feature being developed (used for stateful test flows)
- Config files: `.env`, `.env.example`, `drizzle.config.ts`
- Common project files: `package.json`, `tsconfig.json`, `scripts/`

### Available scripts

These are the full set. Pick only what your demo needs.

| Script | Command | Behavior |
|--------|---------|----------|
| `scripts/server.sh` | `npm run server` | Long-running API server with request logs on port 4000 |
| `scripts/dev.sh` | `npm run dev` | Long-running dev server with HMR updates |
| `scripts/test.sh` | `npm run test` | Stateful test suite (see below) |
| `scripts/migrate.sh` | `npm run migrate` | Runs migrations (creates `/tmp/northwind-migrated`) |
| `scripts/seed.sh` | `npm run seed` | Seeds fake data (creates `/tmp/northwind-seeded`) |
| `scripts/reset.sh` | `npm run reset` | Clears state files for re-runs |
| `scripts/build.sh` | `npm run build` | 5-step production build, exits 0 |
| `scripts/lint.sh` | `npm run lint` | Lint check with warnings and errors, exits 1 |
| `scripts/typecheck.sh` | `npm run typecheck` | Type check with 2 errors, exits 1 |
| `scripts/test-watch.sh` | `npm run test:watch` | Continuous test watcher |

### Stateful test flow

The test script uses marker files (`/tmp/northwind-migrated`, `/tmp/northwind-seeded`) to determine which stage the project is at:

1. **No migration**: tests fail with `relation "shipping_addresses" does not exist`
2. **Migrated, no seed**: tests fail with `customer.shippingAddress` undefined
3. **Migrated + seeded**: all tests pass

Run `npm run reset` before each demo to clear state.

### Customizing Northwind for your extension

You should adapt the project to create scenarios that naturally exercise your extension. Examples:

- **Guardrails**: add `.env` with real-looking secrets, `.env.example` with safe patterns, `drizzle.config.ts` for ORM config. The demo prompt can ask the agent to manually write a migration file (which guardrails should block, since the project uses `drizzle-kit generate`).
- **Processes**: use the long-running scripts (server, dev, test-watch) to show background process management.
- **Custom tools**: add project files that the tool operates on.
- **Hooks**: add files or configs that trigger hook patterns (blocked and allowed cases).

Add whatever files make sense: `.env`, `drizzle.config.ts`, `src/` stubs, `docker-compose.yml`, etc. The scripts are just bash with sleep/echo -- easy to create new ones or modify existing ones.

## Demo Directory Structure

```
<demo-dir>/
├── northwind/                     # The fake project (agent runs pi here)
│   ├── .pi/
│   │   ├── settings.json          # Registers the extension as a local path
│   │   └── prompts/
│   │       └── <demo-name>.md     # The demo prompt
│   ├── AGENTS.md                  # Agent instructions
│   ├── package.json               # npm scripts pointing to shell scripts
│   └── scripts/                   # Simulated shell scripts
├── shell.nix                      # Nix dev environment (outside northwind)
└── .envrc                         # direnv config (outside northwind)
```

The outer directory holds the Nix/direnv setup. The inner `northwind/` directory is where pi runs. This way oh-my-posh (or similar prompt tools) display "northwind" in the terminal prompt.

## Setup Workflow

### 1. Detect the Extension

Check `package.json` in the target directory for a `pi` key with `extensions`, `themes`, or `skills`. Read the README and source to understand what the extension provides: tools, commands, hooks, providers, themes.

### 2. Create Demo Directory

```bash
demo_dir="<path>"
mkdir -p "$demo_dir/northwind/.pi/prompts"
mkdir -p "$demo_dir/northwind/scripts"
```

### 3. Register the Extension

Create `northwind/.pi/settings.json` pointing to the extension's absolute path:

```json
{
  "packages": [
    "/absolute/path/to/extension"
  ],
  "defaultThinkingLevel": "off"
}
```

Use `defaultThinkingLevel: "off"` to keep responses fast and visible during demos.

### 4. Write the Demo Prompt

Create `northwind/.pi/prompts/<demo-name>.md`. Name it after what the demo shows (e.g., `test-shipping-feature.md`). Structure it as numbered steps that run without user confirmation between steps.

```markdown
---
description: Showcase the <extension-name> extension
---

Demo the <extension-name> extension by <scenario>. Run through all steps without waiting for confirmation. Keep messages short.

## 1. <Step Name>

<What to do.>

## 2. <Next Step>

...
```

### 5. Add Fixture Files

Start from the Northwind base and customize:

- Copy relevant scripts into `northwind/scripts/`
- Create `northwind/package.json` with npm script entries
- Add project files the extension needs (`.env`, config files, source stubs, etc.)
- Create new scripts if the demo needs behaviors Northwind doesn't provide

### 6. Add AGENTS.md

Always add a `northwind/AGENTS.md` that:
- Describes the project briefly
- Lists available scripts and project files
- Instructs the agent to NOT search the codebase or read source files
- Tells the agent to just run the scripts and use the files as-is

The AGENTS.md should make the agent feel like it's working in a real project. Tailor it to the extension -- for guardrails, mention the ORM and conventions; for processes, emphasize which scripts are long-running.

## Demo Prompt Patterns by Extension Type

### Extensions with Tools

Build a narrative workflow (like "test a new feature" or "set up the project") that naturally exercises the tools. The agent should encounter problems and react to them, not just call tools in sequence.

### Extensions with Hooks

Build a workflow where the agent naturally triggers hooks. Include both blocked and allowed cases so the demo shows the extension intervening and also stepping aside. For example: the agent tries to manually write a migration (blocked), then uses the ORM generate command instead (allowed).

### Extensions with Commands

Run each command (e.g., `/extension:command`) to show the interactive UI.

### Extensions with Providers

1. Switch to the provider: `/model <provider>`
2. Send a test message
3. Show provider-specific commands (quotas, usage, balance)
4. If the provider has tools (web search), use them
5. Switch back to default provider

### Themes

Themes don't need Northwind. Just switch themes and write a code file for syntax highlighting.

## Output

After creating the demo directory, print the path and instructions:

```
Demo ready at: <path>

  cd <path>/northwind
  pi

Then type /<demo-name> to start.
```
