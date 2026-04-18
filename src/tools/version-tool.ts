import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

const VersionParams = Type.Object({});
type VersionParamsType = Record<string, never>;

interface VersionDetails {
  version?: string;
}

export function setupVersionTool(pi: ExtensionAPI) {
  pi.registerTool<typeof VersionParams, VersionDetails>({
    name: "pi_version",
    label: "Pi Version",
    description: "Get the version of the currently running Pi instance",
    promptSnippet: "Check the current Pi version.",
    promptGuidelines: [
      "Use pi_version when the user asks about the Pi version or when a task depends on knowing the installed version.",
    ],

    parameters: VersionParams,

    async execute(
      _toolCallId: string,
      _params: VersionParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _ctx: ExtensionContext,
    ): Promise<AgentToolResult<VersionDetails>> {
      return {
        content: [{ type: "text", text: `Pi version ${VERSION}` }],
        details: { version: VERSION },
      };
    },

    renderCall(_args: VersionParamsType, theme: Theme) {
      return new ToolCallHeader({ toolName: "Pi Version" }, theme);
    },

    renderResult(
      result: AgentToolResult<VersionDetails>,
      _options: ToolRenderResultOptions,
      theme: Theme,
    ): Text {
      const { details } = result;

      if (!details?.version) {
        const textBlock = result.content.find((c) => c.type === "text");
        const msg =
          (textBlock?.type === "text" && textBlock.text) || "Unknown version";
        return new Text(theme.fg("error", msg), 0, 0);
      }

      return new Text(
        theme.fg("accent", `Pi version: ${details.version}`),
        0,
        0,
      );
    },
  });
}
