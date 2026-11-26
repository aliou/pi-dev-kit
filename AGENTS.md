# pi-dev-kit

Public Pi package (`@aliou/pi-dev-kit` on npm) with tools, an update command, and the `pi-extension` skill that other agents follow to build Pi extensions. Wrong guidance here propagates into every extension built with it.

## Commands

- Run `pnpm typecheck` and `pnpm lint`; the husky pre-commit hook runs both.

## Conventions

- Every change to shipped content (`src/`, including skills and prompts) gets a patch changeset in `.changeset/`, written by hand.
- Verify skill guidance against the installed Pi docs and changelog or a sibling extension's source before writing it.
- When changing the `pi-extension` skill, check whether `src/commands/update.ts` repeats the same guidance and update both.

## Deviations

This package uses the single-directory pattern (`src/tools/`, `src/commands/`) instead of the multi-extension pattern (`extensions/`). It has no config and no sub-extensions, so the event bus and nested config are not justified. New extensions should default to the multi-extension pattern documented in the pi-extension skill.
