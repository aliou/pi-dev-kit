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
import { keyHint } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { findPiInstallation } from "./utils";

const DocsParamsSchema = Type.Object({});
type DocsParams = Record<string, never>;

interface DocsDetails {
  /** Relative paths from the pi install root, markdown only. */
  docFiles?: string[];
  installPath?: string;
}

function listFilesRecursive(dir: string, prefix = ""): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(path.join(dir, entry.name), rel));
    } else {
      results.push(rel);
    }
  }
  return results;
}

export function setupDocsTool(pi: ExtensionAPI) {
  pi.registerTool<typeof DocsParamsSchema, DocsDetails>({
    name: "pi_docs",
    label: "Pi Documentation",
    description:
      "List Pi markdown documentation files (README, docs/, examples/)",

    promptSnippet: "List Pi documentation files",
    promptGuidelines: [
      "Use to discover available Pi documentation",
      "Returns markdown files from README.md, docs/, and examples/",
    ],

    parameters: DocsParamsSchema,

    async execute(
      _toolCallId: string,
      _params: DocsParams,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
    ): Promise<AgentToolResult<DocsDetails>> {
      const piPath = findPiInstallation();
      if (!piPath) {
        throw new Error("Could not locate running Pi installation directory");
      }

      const readmePath = path.join(piPath, "README.md");
      const docsDir = path.join(piPath, "docs");
      const examplesDir = path.join(piPath, "examples");

      const docFiles: string[] = [];

      if (fs.existsSync(readmePath)) {
        docFiles.push("README.md");
      }

      if (fs.existsSync(docsDir)) {
        for (const file of listFilesRecursive(docsDir)) {
          if (file.endsWith(".md")) {
            docFiles.push(`docs/${file}`);
          }
        }
      }

      if (fs.existsSync(examplesDir)) {
        for (const file of listFilesRecursive(examplesDir)) {
          if (file.endsWith(".md")) {
            docFiles.push(`examples/${file}`);
          }
        }
      }

      if (docFiles.length === 0) {
        throw new Error(
          `No markdown documentation found in Pi installation at ${piPath}`,
        );
      }

      // Content sent to LLM: full relative paths so it can read them.
      const lines = docFiles.map((rel) => `${path.join(piPath, rel)} (${rel})`);
      const message = `${docFiles.length} markdown files:\n${lines.join("\n")}`;

      return {
        content: [{ type: "text", text: message }],
        details: {
          docFiles,
          installPath: piPath,
        },
      };
    },

    renderCall(_args: DocsParams, theme: Theme) {
      return new ToolCallHeader({ toolName: "Pi Docs" }, theme);
    },

    renderResult(
      result: AgentToolResult<DocsDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { details } = result;
      const { isPartial } = options;

      // Handle isPartial first (this tool doesn't stream, but keep the pattern)
      if (isPartial) {
        return new Text(theme.fg("dim", "Loading..."), 0, 0);
      }

      // Check for missing expected fields in details to detect errors
      if (!details || !details.docFiles) {
        const text = result.content[0];
        return new Text(
          text?.type === "text" && text.text ? text.text : "No result",
          0,
          0,
        );
      }

      const { docFiles } = details;
      const fields: Array<
        { label: string; value: string; showCollapsed?: boolean } | Text
      > = [];

      if (options.expanded) {
        // Expanded view: show full file list
        const lines: string[] = [];
        lines.push(
          theme.fg("accent", `${docFiles.length} markdown files:`),
          "",
        );
        for (const rel of docFiles) {
          lines.push(theme.fg("dim", `  ${rel}`));
        }
        fields.push(new Text(lines.join("\n"), 0, 0));
      } else {
        // Collapsed view: show file count + expand hint
        fields.push({
          label: "Files",
          value:
            theme.fg("accent", `${docFiles.length} markdown files`) +
            ` (${keyHint("app.tools.expand", "to expand")})`,
          showCollapsed: true,
        });
      }

      // Only show footer if there are items worth showing
      const footer = new ToolFooter(theme, {
        items: [
          {
            label: "docs",
            value: String(docFiles.length),
            tone: "accent",
          },
        ],
      });

      return new ToolBody({ fields, footer }, options, theme);
    },
  });
}
