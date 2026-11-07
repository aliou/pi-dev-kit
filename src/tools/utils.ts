import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

const require = createRequire(import.meta.url);

const PI_PACKAGE_NAMES = [
  "@earendil-works/pi-coding-agent",
  "@mariozechner/pi-coding-agent",
] as const;

function resolvePackageDir(packageName: string): string | null {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    return null;
  }
}

function readPackageJsonSafe(filePath: string): { name?: string } | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Find the currently running Pi installation directory by resolving the
 * pi-coding-agent package location.
 */
export function findPiInstallation(): string | null {
  for (const packageName of PI_PACKAGE_NAMES) {
    const packageDir = resolvePackageDir(packageName);
    if (packageDir) return packageDir;
  }

  const scriptPath = process.argv[1];
  if (scriptPath) {
    let currentDir = path.dirname(scriptPath);

    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = readPackageJsonSafe(packageJsonPath);
        if (
          packageJson &&
          PI_PACKAGE_NAMES.includes(
            packageJson.name as (typeof PI_PACKAGE_NAMES)[number],
          )
        ) {
          return currentDir;
        }
      }
      currentDir = path.dirname(currentDir);
    }
  }

  return null;
}
