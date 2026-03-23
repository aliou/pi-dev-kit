import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Find the currently running Pi installation directory by resolving the
 * pi-coding-agent package location.
 */
export function findPiInstallation(): string | null {
  try {
    const piModulePath = require.resolve(
      "@mariozechner/pi-coding-agent/package.json",
    );
    return path.dirname(piModulePath);
  } catch (_error) {
    const scriptPath = process.argv[1];
    if (scriptPath) {
      let currentDir = path.dirname(scriptPath);

      while (currentDir !== path.dirname(currentDir)) {
        const packageJsonPath = path.join(currentDir, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageContent = fs.readFileSync(packageJsonPath, "utf-8");
            const packageJson = JSON.parse(packageContent);
            if (packageJson.name === "@mariozechner/pi-coding-agent") {
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
}
