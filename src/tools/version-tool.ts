import { ToolCallHeader } from "@aliou/pi-utils-ui";
import type {
  AgentToolResult,
  ExtensionAPI,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { defineTool, VERSION } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { type Static, Type } from "typebox";

const VersionParams = Type.Object({});
type VersionParamsType = Static<typeof VersionParams>;

function renderVersionCall(_args: VersionParamsType, theme: Theme) {
  return new ToolCallHeader({ toolName: "Pi Version" }, theme);
}

interface VersionDetails {
  version?: string;
}

const versionTool = defineTool({
  name: "pi_version",
  label: "Pi Version",
  description: "Get the version of the currently running Pi instance",
  promptSnippet: "Check the current Pi version.",
  promptGuidelines: [
    "Use pi_version when the user asks about the Pi version or when a task depends on knowing the installed version.",
  ],

  parameters: VersionParams,

  async execute(
    _toolCallId,
    _params,
    _signal,
    _onUpdate,
    _ctx,
  ): Promise<AgentToolResult<VersionDetails>> {
    return {
      content: [{ type: "text", text: `Pi version ${VERSION}` }],
      details: { version: VERSION },
    };
  },

  renderCall(args, theme) {
    return renderVersionCall(args, theme);
  },

  renderResult(result, _options, theme) {
    const { details } = result;

    if (!details?.version) {
      const textBlock = result.content.find((c) => c.type === "text");
      const msg =
        (textBlock?.type === "text" && textBlock.text) || "Unknown version";
      return new Text(theme.fg("error", msg), 0, 0);
    }

    return new Text(theme.fg("accent", `Pi version: ${details.version}`), 0, 0);
  },
});

export function setupVersionTool(pi: ExtensionAPI) {
  pi.registerTool(versionTool);
}
