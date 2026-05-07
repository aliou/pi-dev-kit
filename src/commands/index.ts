import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerUpdateCommand } from "./update";

export function registerCommands(pi: ExtensionAPI) {
  registerUpdateCommand(pi);
}

export default function commandsExtension(pi: ExtensionAPI) {
  registerCommands(pi);
}
