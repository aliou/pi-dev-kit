# Publishing

Pi packages are published to npm or installed from git/local paths with `pi install`.

## Package Setup

A publishable package needs Pi metadata and discoverability fields.

```json
{
  "name": "@scope/pi-my-extension",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "private": false,
  "keywords": ["pi-package", "pi-extension", "pi"],
  "publishConfig": { "access": "public" },
  "files": ["src", "README.md"],
  "pi": {
    "extensions": ["./src/tools/index.ts", "./src/commands/index.ts"]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "typebox": "*"
  },
  "peerDependenciesMeta": {
    "@earendil-works/pi-coding-agent": { "optional": true },
    "typebox": { "optional": true }
  }
}
```

Use the legacy `@mariozechner/*` namespace only while the target Pi packages are not published under `@earendil-works/*`.

Pi core packages imported at runtime belong in optional `peerDependencies` with `"*"`. Keep exact target versions in `devDependencies` for local type checking. Third-party runtime packages belong in `dependencies`.

## Installation Specs

Users can install with:

```bash
pi install npm:@scope/pi-my-extension
pi install git:github.com/org/pi-my-extension@v1.0.0
pi install ./relative/path/to/package
```

By default, global installs write to `~/.pi/agent/settings.json`; `-l` writes project settings.

## Versioning with Changesets

Use Changesets for versioning and changelogs.

### `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### Creating a changeset

In headless agent sessions, write the file directly instead of running the interactive CLI.

```md
---
"@scope/pi-my-extension": patch
---

Describe the user-visible change.
```

Use:

- `patch` for fixes and internal compatibility updates.
- `minor` for new user-facing features.
- `major` for breaking changes.

Commit the changeset with the change it describes.

### Manual release

```bash
pnpm changeset version
pnpm changeset publish
```

## GitHub Actions Automation

Use the template publish workflow from `pi-extension-template`.

It handles:

- Pending changesets: opens or updates a version PR.
- Version PR merged: publishes to npm and creates a GitHub release.

Required secrets:

- `GITHUB_TOKEN`: provided by GitHub Actions.
- `NPM_TOKEN`: npm automation token with publish access.

Keep `NPM_CONFIG_PROVENANCE=true` and `id-token: write` for provenance.

## First Publish

Before first publish:

1. Set `"private": false`.
2. Set `"publishConfig": { "access": "public" }` for scoped public packages.
3. Add `NPM_TOKEN` to repo secrets.
4. Merge the first Changesets version PR.

npm creates the package entry on first publish. If the npm scope is new to your account, you may need to create the scope or publish once manually with `--access public`.

## Monorepo Dependency Rules

Public packages cannot depend on private workspace packages. Users installing from npm will not have those private packages.

When adding a dependency:

1. If it is a public workspace package, use `workspace:^` in the monorepo and make sure it is published.
2. If it is private, do not depend on it from a public package.
3. For external packages, use a normal npm range.

Run the repo's public-dependency check when available, for example `pnpm run check:public-deps`.

## Pre-publish Checklist

- [ ] `private` is `false`.
- [ ] `publishConfig.access` is `public` for scoped public packages.
- [ ] `keywords` includes `pi-package`.
- [ ] `files` lists only shipped files users need.
- [ ] `pi.extensions`, `pi.skills`, `pi.prompts`, and `pi.themes` paths are correct.
- [ ] Demo `pi.video` or `pi.image` metadata is present when available.
- [ ] Imported Pi core packages are optional peers with `"*"`.
- [ ] Imported Pi core packages are exact dev dependencies for type checking.
- [ ] Third-party runtime packages are in `dependencies`.
- [ ] No private workspace dependencies in public packages.
- [ ] `prepare` is `[ -d .git ] && husky || true`, not bare `husky`.
- [ ] `check:lockfile` exists.
- [ ] README documents setup, tools, commands, providers, env vars, and limitations.
- [ ] Missing API keys are handled with notifications or disabled features, not crashes.
- [ ] `pnpm typecheck` and `pnpm lint` pass.
- [ ] `.github/workflows/publish.yml` is present if using CI publish.
- [ ] `NPM_TOKEN` is configured before relying on CI publish.
