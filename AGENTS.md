# pi-dev-kit

Public Pi extension providing tools and prompts for building, maintaining, and updating Pi extensions.

## Stack

- TypeScript (strict mode), pnpm 10.26.1, Biome, Changesets

## Scripts

- `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm changeset`

## Structure

- `src/index.ts` - entry, `src/commands/` - slash commands, `src/tools/` - tool impls, `src/skills/` - dev guidance, `src/prompts/` - templates
