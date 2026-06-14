import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";

const NPM_REGISTRY_URL =
  "https://registry.npmjs.org/@earendil-works/pi-coding-agent/latest";

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(NPM_REGISTRY_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

const UPDATE_PROMPT = `# Update Pi Extensions

Update this project's Pi extensions, themes, skills, prompt templates, and package metadata to the specified target Pi version.

## Operating Rules

- Keep the update focused on Pi compatibility and current extension best practices.
- Read the relevant Pi docs before changing code. Follow linked docs when a page points to them.
- Present a concrete plan and wait for user confirmation before editing files.
- If a migration is ambiguous or changes public behavior, ask the user instead of guessing.
- Preserve existing extension behavior unless the target Pi version requires a change.

## 1. Detect Package Manager

Use \`detect_package_manager\` to identify npm, pnpm, yarn, or bun. Use the detected install and run commands for every later step.

## 2. Inspect Package State

Read \`./package.json\` and any sub-package \`package.json\` files. Find Pi core packages in all dependency sections, peer dependency metadata, pnpm overrides, imports, docs, and examples.

Current Pi core packages are:
- \`@earendil-works/pi-coding-agent\`
- \`@earendil-works/pi-agent-core\`
- \`@earendil-works/pi-ai\`
- \`@earendil-works/pi-tui\`
- \`typebox\`


For distributed Pi packages:
- Put imported Pi core packages in \`peerDependencies\` and mark each one \`optional: true\` in \`peerDependenciesMeta\`.
- Use \`"*"\` for Pi core peer ranges by default, per Pi package docs.
- Only use a minimum range such as \`">=0.75.0"\` when source code uses an API that the changelog/docs show was introduced after Pi 0.74.0. In that case, set the minimum to the exact version that introduced the required API.
- Keep the same Pi core packages in \`devDependencies\` at the exact target version for local type checking.
- Keep \`typebox\` 1.x. Do not use \`@sinclair/typebox\` in new code.

Report current versions/namespaces vs target before planning code changes. If everything already matches and no code/docs best-practice updates are needed, stop.

## 3. Gather Pi Documentation

If an update is needed:
1. Use \`pi_changelog_versions\` and \`pi_changelog\` for every version between the current and target versions.
2. Use \`pi_docs\` to locate installed Pi docs.
3. Read relevant docs completely before editing, especially:
   - \`docs/extensions.md\`
   - \`docs/tui.md\` for components and renderers
   - \`docs/packages.md\` for package metadata and peer dependency rules
   - \`docs/custom-provider.md\` and \`docs/models.md\` for providers
   - \`docs/rpc.md\` when UI or mode behavior is touched
   - \`docs/skills.md\` when package skills are touched
4. Read examples that match the changed area, not just the docs.

## 4. Analyze Source and Docs

Scan all source, tests, README, skills, prompts, and examples for Pi usage.

For tools, verify:
- Standalone tool objects use \`defineTool({...})\` from Pi so \`execute\`, \`renderCall\`, and \`renderResult\` infer params from \`parameters\`. Do not pass explicit generic arguments to \`defineTool\` and avoid callback parameter annotations unless TypeScript needs help.
- Define \`type MyToolParams = Static<typeof parameters>\` for helper/action APIs, but prefer inference inside \`defineTool\` callbacks.
- Every tool has \`label\`. Add \`promptSnippet\` when the tool should appear in Available tools.
- Every \`promptGuidelines\` bullet names the exact tool, because Pi injects bullets flat into the global Guidelines section. Do not write "this tool".
- Execute signature is \`(toolCallId, params, signal, onUpdate, ctx)\`; signal comes before \`onUpdate\`.
- Use \`onUpdate?.(...)\` and forward \`signal\` to \`fetch\`, \`pi.exec\`, SDK clients, and long work.
- Use \`StringEnum\` from \`@earendil-works/pi-ai\` for string enums; avoid \`Type.Union([Type.Literal(...)])\` for model-facing enums.
- Use \`prepareArguments(args)\` only for backward-compatible schema shims before validation.
- Use \`executionMode: "sequential"\` for tools whose sibling calls mutate shared in-memory state or otherwise must not run concurrently.
- File-mutating tools normalize leading \`@\` in paths and wrap the full read-modify-write window in \`withFileMutationQueue()\`.
- Tools returning large output use \`truncateHead\` or \`truncateTail\`, tell the LLM what was truncated, and write full output to a temp file.
- Do not use Node \`child_process\` for normal commands; use \`pi.exec(command, args, { signal, cwd, timeout })\`.

For rendering and TUI, verify:
- \`renderCall\` and \`renderResult\` return Pi TUI \`Component\` objects, not raw strings.
- \`renderResult\` handles \`options.isPartial\` first with a stable tool-scoped message.
- Tool errors are detected via missing expected fields in \`details\` or the 4th render context \`context.isError\`.
- Use \`ToolCallHeader\`, \`ToolBody\`, and \`ToolFooter\` consistently. Omit empty footers.
- Use \`keyHint("app.tools.expand", "to expand")\` for expand hints.
- Use \`Container\`, \`Text\`, \`Markdown\`, \`SelectList\`, \`SettingsList\`, \`BorderedLoader\`, and \`DynamicBorder\` before writing custom UI.
- Custom components implement \`render(width): string[]\`, \`handleInput(data)\`, and \`invalidate()\`; use \`matchesKey\` and keep rendered lines within width.
- \`ctx.ui.custom()\` has RPC/print fallback and interactive close paths use explicit sentinels such as \`null\` or \`"closed"\`, not \`done(undefined)\`.

For extension APIs, verify:
- Hook return shapes match current Pi docs: \`input\` returns \`{ action: "continue" | "transform" | "handled", ... }\`; \`before_agent_start\` returns \`{ systemPrompt }\`; \`tool_result\` returns result patches.
- Session replacement uses \`withSession\` after \`ctx.newSession()\`, \`ctx.fork()\`, or \`ctx.switchSession()\`; do not reuse captured old \`pi\`, command \`ctx\`, or \`ctx.sessionManager\`.
- Reload command handlers treat \`await ctx.reload(); return;\` as terminal.
- Fire-and-forget UI methods do not need \`ctx.hasUI\`; dialog methods that gate behavior do.
- Providers use current \`pi.registerProvider(name, config)\`, \`name\`, \`authHeader\`, OAuth, per-model \`baseUrl\`, and \`thinkingLevelMap\` when relevant. Dynamic model discovery belongs in an async extension factory, not \`session_start\`.
- Use SDK helpers for Pi paths instead of \`homedir()\` when helpers exist.

For project structure and package docs, verify:
- Prefer one extension entry point per domain directory under \`extensions/\`. The main extension owns config loading, settings, and feature discovery. Sub-extensions register via the event bus.
- \`src/\` is Pi-agnostic: no imports from \`@earendil-works/pi-*\`. All Pi registration code lives under \`extensions/\`.
- Config in \`src/config/\` with \`types.ts\`, \`defaults.ts\`, \`loader.ts\`, and \`migration/\`. Use per-feature nested config sections.
- Event bus constants and payload types in \`src/events.ts\`.
- Keep domain logic in Pi-free core modules and extensions as thin wrappers.
- No \`.js\` suffixes in TypeScript imports.

## 5. Create Update Plan

Present a detailed plan with:
- Package namespace/version changes.
- Files to change and why.
- API migrations required by changelogs/docs.
- Best-practice cleanups found in source, README, skills, prompts, and examples.
- Verification commands to run.

Ask for confirmation before editing.

## 6. Execute After Confirmation

After the user confirms:
1. Apply package metadata changes.
2. Apply source/docs/skill/prompt changes.
3. Run the detected install command.
4. Run typecheck.
5. Run lint if available.
6. Report changed files, verification results, and any remaining risks.

## 7. Commit Changes When Asked

Only commit if the user asks. If committing:
1. Run \`git status\`.
2. Stage only files changed for this update; never use \`git add .\`.
3. Follow the repository's commit style, defaulting to \`chore: update pi packages to X.Y.Z\`.
4. Include a short body listing breaking changes handled.

## Fallbacks

If \`pi_changelog\`, \`pi_docs\`, or \`detect_package_manager\` fail, manually inspect the installed Pi package directory, its \`CHANGELOG.md\`, \`README.md\`, \`docs/\`, \`examples/\`, lockfiles, and \`package.json\`.`;

export function registerUpdateCommand(pi: ExtensionAPI) {
  pi.registerCommand("extensions:update", {
    description: "Update Pi extensions to a target version (current or latest)",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;

      let targetVersion: string;

      if (args?.trim()) {
        // Version passed as argument.
        targetVersion = args.trim().replace(/^v/, "");
      } else {
        // Fetch latest and let user choose.
        ctx.ui.setStatus("extensions:update", "Checking latest version...");
        const latest = await fetchLatestVersion();
        ctx.ui.setStatus("extensions:update", undefined);

        if (!latest || latest === VERSION) {
          // Either fetch failed or already on latest -- use installed version.
          targetVersion = VERSION;
          if (!latest) {
            ctx.ui.notify(
              "Could not fetch latest version from npm, using installed version.",
              "warning",
            );
          }
        } else {
          const choice = await ctx.ui.select(
            `Installed: ${VERSION}, Latest: ${latest}`,
            [`${latest} (latest)`, `${VERSION} (installed)`],
          );

          if (choice === undefined) return; // cancelled

          targetVersion = choice.startsWith(latest) ? latest : VERSION;
        }
      }

      pi.sendUserMessage(
        `Target Pi version: ${targetVersion}\n\n${UPDATE_PROMPT}`,
      );
    },
  });
}
