import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupChangelogTool } from "./changelog-tool";
import { setupDocsTool } from "./docs-tool";
import { setupPackageManagerTool } from "./package-manager-tool";
import { setupVersionTool } from "./version-tool";

export function setupTools(pi: ExtensionAPI) {
  setupPackageManagerTool(pi);
  setupVersionTool(pi);
  setupDocsTool(pi);
  setupChangelogTool(pi);
}

export default function toolsExtension(pi: ExtensionAPI) {
  setupTools(pi);
}
