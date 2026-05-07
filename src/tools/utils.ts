import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

const require = createRequire(import.meta.url);

const PI_PACKAGE_NAMES = [
  "@earendil-works/pi-coding-agent",
  "@mariozechner/pi-coding-agent",
] as const;

/**
 * Find the currently running Pi installation directory by resolving the
 * pi-coding-agent package location.
 */
export function findPiInstallation(): string | null {
  for (const packageName of PI_PACKAGE_NAMES) {
    try {
      const piModulePath = require.resolve(`${packageName}/package.json`);
      return path.dirname(piModulePath);
    } catch {
      // Try the next package namespace.
    }
  }

  const scriptPath = process.argv[1];
  if (scriptPath) {
    let currentDir = path.dirname(scriptPath);

    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageContent = fs.readFileSync(packageJsonPath, "utf-8");
          const packageJson = JSON.parse(packageContent);
          if (PI_PACKAGE_NAMES.includes(packageJson.name)) {
            return currentDir;
          }
        } catch {
          // Continue searching
        }
      }
      currentDir = path.dirname(currentDir);
    }
  }

  return null;
}
