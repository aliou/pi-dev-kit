import * as fs from "node:fs";
import * as path from "node:path";
import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "typebox";

const Params = Type.Object({});
type PackageManagerParams = Static<typeof Params>;

function renderPackageManagerCall(_args: PackageManagerParams, theme: Theme) {
  return new ToolCallHeader({ toolName: "Detect Package Manager" }, theme);
}

interface PackageManagerDetails {
  packageManager?: string;
  version?: string;
  lockfile?: string;
  installCommand?: string;
  runCommand?: string;
  cwd?: string;
}

const LOCKFILES: Record<string, string> = {
  "pnpm-lock.yaml": "pnpm",
  "yarn.lock": "yarn",
  "package-lock.json": "npm",
  "bun.lockb": "bun",
  "bun.lock": "bun",
};

const COMMANDS: Record<string, { install: string; run: string }> = {
  pnpm: { install: "pnpm install", run: "pnpm" },
  yarn: { install: "yarn install", run: "yarn" },
  npm: { install: "npm install", run: "npm run" },
  bun: { install: "bun install", run: "bun run" },
};

const packageManagerTool = defineTool({
  name: "detect_package_manager",
  label: "Package Manager",
  description:
    "Detect the package manager used in the current project by checking lockfiles and package.json",
  promptSnippet: "Detect the package manager for this project",
  promptGuidelines: [
    "Use detect_package_manager when you need to know which package manager (npm, yarn, pnpm, bun) the project uses",
    "detect_package_manager is helpful before running install commands or scripts",
  ],

  parameters: Params,

  async execute(
    _toolCallId,
    _params,
    _signal,
    _onUpdate,
    ctx,
  ): Promise<AgentToolResult<PackageManagerDetails>> {
    const cwd = ctx.cwd;

    const packageJsonPath = path.join(cwd, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`No package.json found in ${cwd}`);
    }

    // Walk up from cwd to repo root, collecting packageManager and lockfile.
    // Stop at .git boundary to avoid escaping the repository.
    let declaredPm: string | undefined;
    let declaredVersion: string | undefined;
    let lockfile: string | undefined;
    let lockfilePm: string | undefined;

    let searchDir = cwd;
    while (true) {
      // Check packageManager field in package.json
      if (!declaredPm) {
        const pkgPath = path.join(searchDir, "package.json");
        try {
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            if (typeof pkg.packageManager === "string") {
              const match = pkg.packageManager.match(/^([^@]+)@?(.*)?$/);
              if (match) {
                declaredPm = match[1];
                declaredVersion = match[2] || undefined;
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Check lockfiles
      if (!lockfilePm) {
        for (const [filename, pm] of Object.entries(LOCKFILES)) {
          if (fs.existsSync(path.join(searchDir, filename))) {
            lockfilePm = pm;
            lockfile = filename;
            break;
          }
        }
      }

      // Stop if we found both, hit .git, or hit filesystem root
      if (
        (declaredPm && lockfilePm) ||
        fs.existsSync(path.join(searchDir, ".git"))
      ) {
        break;
      }
      const parent = path.dirname(searchDir);
      if (parent === searchDir) break;
      searchDir = parent;
    }

    const pm = declaredPm || lockfilePm || "npm";
    const fallback = { install: `${pm} install`, run: pm };
    const commands = COMMANDS[pm] ?? fallback;

    const parts: string[] = [];
    parts.push(`Package manager: ${pm}`);
    if (declaredVersion) {
      parts.push(`Declared version: ${declaredVersion}`);
    }
    if (lockfile) {
      parts.push(`Lockfile: ${lockfile}`);
    }
    if (!lockfile && !declaredPm) {
      parts.push(
        "No lockfile or packageManager field found, defaulting to npm",
      );
    }
    parts.push(`Install: ${commands.install}`);
    parts.push(`Run: ${commands.run}`);

    const message = parts.join("\n");

    return {
      content: [{ type: "text", text: message }],
      details: {
        packageManager: pm,
        version: declaredVersion,
        lockfile,
        installCommand: commands.install,
        runCommand: commands.run,
        cwd,
      },
    };
  },

  renderCall(args, theme) {
    return renderPackageManagerCall(args, theme);
  },

  renderResult(result, _options, theme) {
    const { details } = result;

    // Check for missing expected fields (framework passes {} on error)
    if (!details?.packageManager) {
      // Extract error message from result.content
      const text = result.content[0];
      const errorMessage =
        text?.type === "text" && text.text
          ? text.text
          : "Failed to detect package manager";
      return new Text(theme.fg("error", errorMessage), 0, 0);
    }

    const lines: string[] = [];
    lines.push(
      theme.fg(
        "success",
        `Package manager: ${theme.bold(details.packageManager)}`,
      ),
    );
    if (details.version) {
      lines.push(theme.fg("dim", `Version: ${details.version}`));
    }
    if (details.lockfile) {
      lines.push(theme.fg("dim", `Lockfile: ${details.lockfile}`));
    }

    return new Text(lines.join("\n"), 0, 0);
  },
});

export function setupPackageManagerTool(pi: ExtensionAPI) {
  pi.registerTool(packageManagerTool);
}
