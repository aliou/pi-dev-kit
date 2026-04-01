import * as fs from "node:fs";
import * as path from "node:path";
import { ToolBody, ToolCallHeader, ToolFooter } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { keyHint, VERSION } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";
import { findPiInstallation } from "./utils";

const GITHUB_RAW_CHANGELOG_URL =
  "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/CHANGELOG.md";

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

const ChangelogParamsSchema = Type.Object({
  version: Type.Optional(
    Type.String({
      description:
        "Specific version to get changelog for. If not provided, returns latest version.",
    }),
  ),
});

type ChangelogParams = Static<typeof ChangelogParamsSchema>;

const ChangelogVersionsParamsSchema = Type.Object({});
type ChangelogVersionsParams = Record<string, never>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChangelogEntry {
  version: string;
  content: string;
}

interface ChangelogDetails {
  changelog?: ChangelogEntry;
  source?: "local" | "github";
}

interface ChangelogVersionsDetails {
  versions?: string[];
  source?: "local" | "github";
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface ParsedChangelog {
  entries: Array<{ version: string; content: string }>;
}

function parseChangelogEntries(changelogContent: string): ParsedChangelog {
  const lines = changelogContent.split("\n");
  const entries: Array<{
    version: string;
    content: string;
    lineStart: number;
    lineEnd: number;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const versionMatch = line.trim().match(/^#+\s*(?:\[([^\]]+)\]|([^[\s]+))/);
    if (versionMatch) {
      const version = versionMatch[1] || versionMatch[2];
      if (version && /^v?\d+\.\d+/.test(version)) {
        entries.push({ version, content: "", lineStart: i, lineEnd: -1 });
      }
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const nextEntry = entries[i + 1];
    const nextStart = nextEntry ? nextEntry.lineStart : lines.length;
    entry.lineEnd = nextStart;

    const contentLines = lines.slice(entry.lineStart + 1, entry.lineEnd);
    const rawContent = contentLines.join("\n").trim();

    const cleanContent = rawContent
      .replace(/^-+$|^=+$|^\*+$|^#+$/gm, "")
      .trim();
    if (!cleanContent || cleanContent.length < 10) {
      entry.content =
        "[Empty changelog entry - no details provided for this version]";
    } else {
      entry.content = rawContent;
    }
  }

  return { entries };
}

function findChangelogEntry(
  changelogContent: string,
  requestedVersion?: string,
): ChangelogEntry {
  const { entries } = parseChangelogEntries(changelogContent);
  if (entries.length === 0) {
    throw new Error("No version entries found in changelog");
  }

  if (requestedVersion) {
    const normalizedRequested = requestedVersion.replace(/^v/, "");
    const entry = entries.find(
      (e) =>
        e.version === requestedVersion ||
        e.version === `v${normalizedRequested}` ||
        e.version.replace(/^v/, "") === normalizedRequested,
    );

    if (entry) {
      return { version: entry.version, content: entry.content };
    }

    const allVersions = entries.map((e) => e.version);
    throw new Error(
      `Version ${requestedVersion} not found. Available versions: ${allVersions.join(", ")}`,
    );
  }

  const latest = entries[0];
  if (!latest) {
    throw new Error("No version entries found in changelog");
  }
  return { version: latest.version, content: latest.content };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNewerThanInstalled(requestedVersion: string): boolean {
  const normalize = (v: string) => v.replace(/^v/, "");
  const req = normalize(requestedVersion);
  const installed = normalize(VERSION);
  if (req === installed) return false;

  const reqParts = req.split(".").map(Number);
  const instParts = installed.split(".").map(Number);
  for (let i = 0; i < Math.max(reqParts.length, instParts.length); i++) {
    const r = reqParts[i] ?? 0;
    const inst = instParts[i] ?? 0;
    if (r > inst) return true;
    if (r < inst) return false;
  }
  return false;
}

async function fetchGithubChangelog(): Promise<string> {
  try {
    const res = await fetch(GITHUB_RAW_CHANGELOG_URL);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch changelog from GitHub: ${res.status} ${res.statusText}`,
      );
    }
    return await res.text();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Failed to fetch")) {
      throw error;
    }
    throw new Error(
      `Failed to fetch changelog from GitHub: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function readLocalChangelog(): { content: string; piPath: string } {
  const piPath = findPiInstallation();
  if (!piPath) {
    throw new Error("Could not locate Pi installation");
  }
  const changelogPath = path.join(piPath, "CHANGELOG.md");
  if (!fs.existsSync(changelogPath)) {
    throw new Error(`Changelog file not found at ${changelogPath}`);
  }
  return { content: fs.readFileSync(changelogPath, "utf-8"), piPath };
}

/** Max lines shown when collapsed. */
const COLLAPSED_LINES = 8;

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

function renderChangelogContent(
  content: string,
  theme: Theme,
  maxLines?: number,
): string[] {
  const allLines = content.split("\n");
  const truncated = maxLines != null && allLines.length > maxLines;
  const linesToRender = truncated ? allLines.slice(0, maxLines) : allLines;

  const out: string[] = [];
  for (const line of linesToRender) {
    if (line.trim().startsWith("###")) {
      out.push(theme.fg("warning", line));
    } else if (line.trim().startsWith("##")) {
      out.push(theme.fg("accent", line));
    } else if (line.trim().startsWith("#")) {
      out.push(theme.fg("accent", theme.bold(line)));
    } else if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
      out.push(theme.fg("dim", line));
    } else {
      out.push(line);
    }
  }

  if (truncated) {
    out.push(theme.fg("muted", "..."));
  }

  return out;
}

// ---------------------------------------------------------------------------
// pi_changelog
// ---------------------------------------------------------------------------

export function setupChangelogTool(pi: ExtensionAPI) {
  pi.registerTool<typeof ChangelogParamsSchema, ChangelogDetails>({
    name: "pi_changelog",
    label: "Pi Changelog",
    description:
      "Get changelog entry for a Pi version. Returns latest by default. Use pi_changelog_versions to list all available versions.",
    promptSnippet: `pi_changelog version="1.2.3" // Get changelog for specific version
pi_changelog // Get latest changelog`,
    promptGuidelines: [
      "Use this tool to check what's new in a Pi version",
      "Use pi_changelog_versions first to list available versions",
      "Leave version empty to get the latest changelog",
    ],

    parameters: ChangelogParamsSchema,

    async execute(
      _toolCallId: string,
      params: ChangelogParams,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
    ): Promise<AgentToolResult<ChangelogDetails>> {
      // Newer than installed -> fetch from GitHub
      if (params.version && isNewerThanInstalled(params.version)) {
        const githubContent = await fetchGithubChangelog();
        const changelog = findChangelogEntry(githubContent, params.version);

        const message = `Changelog for ${changelog.version} (from GitHub)\n\n## ${changelog.version}\n\n${changelog.content}`;
        return {
          content: [{ type: "text", text: message }],
          details: {
            changelog,
            source: "github",
          },
        };
      }

      // Local
      const local = readLocalChangelog();
      const changelog = findChangelogEntry(local.content, params.version);

      const message = `Changelog for ${changelog.version}\n\n## ${changelog.version}\n\n${changelog.content}`;
      return {
        content: [{ type: "text", text: message }],
        details: {
          changelog,
          source: "local",
        },
      };
    },

    renderCall(args: ChangelogParams, theme: Theme) {
      return new ToolCallHeader(
        {
          toolName: "Pi Changelog",
          mainArg: args.version ? `v${args.version}` : "latest",
        },
        theme,
      );
    },

    renderResult(
      result: AgentToolResult<ChangelogDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { details } = result;

      // Check for missing expected fields to detect errors
      if (!details?.changelog) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" && text.text ? text.text : "No result",
          0,
          0,
        );
      }

      const fields: Array<
        { label: string; value: string; showCollapsed?: boolean } | Text
      > = [];

      const lines: string[] = [];

      if (options.expanded) {
        // Expanded view: show full changelog content
        lines.push(
          theme.fg(
            "accent",
            theme.bold(`Version: ${details.changelog.version}`),
          ),
          "",
        );
        lines.push(...renderChangelogContent(details.changelog.content, theme));
        fields.push(new Text(lines.join("\n"), 0, 0));
      } else {
        // Collapsed view: show version + first few lines of changelog + expand hint
        lines.push(
          theme.fg(
            "accent",
            theme.bold(`Version: ${details.changelog.version}`),
          ),
          "",
        );
        lines.push(
          ...renderChangelogContent(
            details.changelog.content,
            theme,
            COLLAPSED_LINES,
          ),
        );
        lines.push(
          "",
          theme.fg("muted", `${keyHint("app.tools.expand", "to expand")}`),
        );
        fields.push(new Text(lines.join("\n"), 0, 0));
      }

      // Footer: show source tag only
      const footer = new ToolFooter(theme, {
        items: [
          {
            label: "source",
            value: details.source ?? "local",
            tone: "accent",
          },
        ],
      });

      return new ToolBody(
        {
          fields,
          footer,
        },
        options,
        theme,
      );
    },
  });

  // -------------------------------------------------------------------------
  // pi_changelog_versions
  // -------------------------------------------------------------------------

  pi.registerTool<
    typeof ChangelogVersionsParamsSchema,
    ChangelogVersionsDetails
  >({
    name: "pi_changelog_versions",
    label: "Pi Changelog Versions",
    description: "List all available Pi changelog versions",
    promptSnippet: `pi_changelog_versions // List all available versions`,

    parameters: ChangelogVersionsParamsSchema,

    async execute(
      _toolCallId: string,
      _params: ChangelogVersionsParams,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
    ): Promise<AgentToolResult<ChangelogVersionsDetails>> {
      const local = readLocalChangelog();
      const { entries } = parseChangelogEntries(local.content);

      if (entries.length === 0) {
        throw new Error("No version entries found in changelog");
      }

      const versions = entries.map((e) => e.version);
      const message = `${versions.length} versions available:\n${versions.join(", ")}`;

      return {
        content: [{ type: "text", text: message }],
        details: {
          versions,
          source: "local",
        },
      };
    },

    renderCall(_args: ChangelogVersionsParams, theme: Theme) {
      return new ToolCallHeader({ toolName: "Pi Changelog Versions" }, theme);
    },

    renderResult(
      result: AgentToolResult<ChangelogVersionsDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { details } = result;

      // Check for missing expected fields to detect errors
      if (!details?.versions) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" && text.text ? text.text : "No result",
          0,
          0,
        );
      }

      const fields: Array<
        { label: string; value: string; showCollapsed?: boolean } | Text
      > = [];

      const lines: string[] = [
        theme.fg("accent", `${details.versions.length} versions available:`),
        "",
      ];
      const cols = 6;
      const maxLen = Math.max(
        ...details.versions.map((version) => version.length),
      );
      const colWidth = maxLen + 2;
      for (let i = 0; i < details.versions.length; i += cols) {
        const row = details.versions
          .slice(i, i + cols)
          .map((version) => version.padEnd(colWidth))
          .join("");
        lines.push(theme.fg("dim", row));
      }
      fields.push(new Text(lines.join("\n"), 0, 0));

      // Footer: just show version count
      const footer = new ToolFooter(theme, {
        items: [
          {
            label: "count",
            value: String(details.versions.length),
            tone: "accent",
          },
        ],
      });

      return new ToolBody(
        {
          fields,
          footer,
        },
        options,
        theme,
      );
    },
  });
}
