# pi-dev-kit

Public Pi extension providing tools and prompts for building, maintaining, and updating Pi extensions.

## Stack

- TypeScript (strict mode), pnpm 10.26.1, Biome, Changesets

## Scripts

- `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm changeset`

## Structure

- `src/tools/` - tool impls (changelog, docs, package-manager, version)
- `src/commands/` - slash commands (extensions:update)
- `src/skills/` - dev guidance (pi-extension skill with references)
- `src/prompts/` - templates

## Deviations

This extension uses the legacy single-directory pattern (`src/tools/`, `src/commands/`) instead of the multi-extension pattern (`extensions/`). It has no config and no sub-extensions, so the overhead of the event bus and nested config is not justified. New extensions should default to the multi-extension pattern documented in the pi-extension skill.
