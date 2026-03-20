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

const DocsParams = Type.Object({});
type DocsParamsType = Record<string, never>;

interface DocsDetails {
  success: boolean;
  message: string;
  /** Relative paths from the pi install root, markdown only. */
  docFiles?: string[];
  installPath?: string;
}

type ExecuteResult = AgentToolResult<DocsDetails>;

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
  pi.registerTool<typeof DocsParams, DocsDetails>({
    name: "pi_docs",
    label: "Pi Documentation",
    description:
      "List Pi markdown documentation files (README, docs/, examples/)",

    parameters: DocsParams,

    async execute(
      _toolCallId: string,
      _params: DocsParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
    ): Promise<ExecuteResult> {
      try {
        const piPath = findPiInstallation();
        if (!piPath) {
          return {
            content: [
              {
                type: "text",
                text: "Could not locate running Pi installation directory",
              },
            ],
            details: {
              success: false,
              message: "Could not locate running Pi installation directory",
            },
          };
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
          return {
            content: [
              {
                type: "text",
                text: `No markdown documentation found in Pi installation`,
              },
            ],
            details: {
              success: false,
              message: `No markdown documentation found in Pi installation`,
              installPath: piPath,
            },
          };
        }

        // Content sent to LLM: full relative paths so it can read them.
        const lines = docFiles.map(
          (rel) => `${path.join(piPath, rel)} (${rel})`,
        );
        const message = `${docFiles.length} markdown files:\n${lines.join("\n")}`;

        return {
          content: [{ type: "text", text: message }],
          details: {
            success: true,
            message: `Found ${docFiles.length} markdown files`,
            docFiles,
            installPath: piPath,
          },
        };
      } catch (error) {
        const message = `Error reading Pi documentation: ${error instanceof Error ? error.message : String(error)}`;
        return {
          content: [{ type: "text", text: message }],
          details: {
            success: false,
            message,
          },
        };
      }
    },

    renderCall(_args: DocsParamsType, theme: Theme) {
      return new ToolCallHeader({ toolName: "Pi Docs" }, theme);
    },

    renderResult(
      result: AgentToolResult<DocsDetails>,
      options: ToolRenderResultOptions,
      theme: Theme,
    ) {
      const { details } = result;

      if (!details) {
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

      if (!details.success) {
        fields.push({
          label: "Error",
          value: theme.fg("error", details.message),
          showCollapsed: true,
        });
      } else if (!details.docFiles || details.docFiles.length === 0) {
        fields.push({
          label: "Result",
          value: theme.fg("warning", "No docs found"),
          showCollapsed: true,
        });
      } else {
        const lines: string[] = [];

        if (options.expanded) {
          lines.push(
            theme.fg("accent", `${details.docFiles.length} markdown files:`),
            "",
          );
          for (const rel of details.docFiles) {
            lines.push(theme.fg("dim", `  ${rel}`));
          }
        } else {
          lines.push(
            theme.fg("accent", `${details.docFiles.length} markdown files`) +
              ` (${keyHint("app.tools.expand", "to expand")})`,
            "",
          );

          const filenames = details.docFiles.map((file) => path.basename(file));
          const maxLen = Math.max(...filenames.map((file) => file.length));
          const colWidth = maxLen + 2;
          const cols = Math.max(1, Math.floor(80 / colWidth));
          for (let i = 0; i < filenames.length; i += cols) {
            const row = filenames
              .slice(i, i + cols)
              .map((file) => file.padEnd(colWidth))
              .join("");
            lines.push(theme.fg("dim", row));
          }
        }

        fields.push(new Text(lines.join("\n"), 0, 0));
      }

      return new ToolBody(
        {
          fields,
          footer: new ToolFooter(theme, {
            items: [
              {
                label: "status",
                value: details.success ? "ok" : "error",
                tone: details.success ? "success" : "error",
              },
              {
                label: "docs",
                value: String(details.docFiles?.length ?? 0),
                tone: "accent",
              },
            ],
          }),
        },
        options,
        theme,
      );
    },
  });
}
