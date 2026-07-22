import { packager } from "@electron/packager";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const stagingDirectory = join(root, "tmp", "m3-2-package-stage");
const outputDirectory = join(root, "release");
const petsDirectory = join(root, "pets");
const iconPath = join(root, "build", "generated", "icon.ico");
const trayIconPath = join(root, "build", "generated", "tray-icon.png");
const hookReceiverPath = join(root, "dist", "hook", "codex-pet-hook.cjs");
const rootPackage = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const targetPlatform = platform();
const targetArch = arch();
const applicationName = "Codex Pet Desktop";

async function requirePath(path, label) {
  try {
    await stat(path);
  } catch (error) {
    throw new Error(`${label} is missing: ${path}`, { cause: error });
  }
}

await Promise.all([
  requirePath(join(root, "dist", "main", "index.cjs"), "Built main bundle"),
  requirePath(join(root, "dist", "renderer", "index.html"), "Built renderer"),
  requirePath(join(petsDirectory, "example-original-pet", "manifest.json"), "Built-in pet"),
  requirePath(iconPath, "Generated application icon"),
  requirePath(trayIconPath, "Generated tray icon"),
  requirePath(hookReceiverPath, "Built hook receiver"),
]);

await rm(stagingDirectory, { recursive: true, force: true });
await mkdir(stagingDirectory, { recursive: true });

try {
  await cp(join(root, "dist"), join(stagingDirectory, "dist"), { recursive: true });
  await writeFile(
    join(stagingDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: rootPackage.name,
        productName: applicationName,
        version: rootPackage.version,
        description: rootPackage.description,
        license: rootPackage.license,
        main: rootPackage.main,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const paths = await packager({
    dir: stagingDirectory,
    name: applicationName,
    executableName: applicationName,
    platform: targetPlatform,
    arch: targetArch,
    out: outputDirectory,
    overwrite: true,
    icon: iconPath,
    asar: true,
    prune: true,
    extraResource: [petsDirectory, hookReceiverPath, trayIconPath],
    electronVersion: rootPackage.devDependencies.electron,
    appVersion: rootPackage.version,
    buildVersion: rootPackage.version,
    win32metadata: {
      CompanyName: "Codex Pet Desktop contributors",
      FileDescription: applicationName,
      ProductName: applicationName,
      InternalName: applicationName,
      OriginalFilename: `${applicationName}.exe`,
      LegalCopyright: `Copyright (c) ${new Date().getUTCFullYear()} Codex Pet Desktop contributors`,
    },
  });

  if (paths.length !== 1)
    throw new Error(`Expected one packaged application, received ${paths.length}`);
  const packagedDirectory = paths[0];
  const resourcesDirectory =
    targetPlatform === "darwin"
      ? join(packagedDirectory, `${applicationName}.app`, "Contents", "Resources")
      : join(packagedDirectory, "resources");
  const executable =
    targetPlatform === "win32"
      ? join(packagedDirectory, `${applicationName}.exe`)
      : targetPlatform === "darwin"
        ? join(packagedDirectory, `${applicationName}.app`, "Contents", "MacOS", applicationName)
        : join(packagedDirectory, applicationName);
  await Promise.all([
    requirePath(executable, "Packaged executable"),
    requirePath(join(resourcesDirectory, "app.asar"), "Packaged app.asar"),
    requirePath(join(resourcesDirectory, "codex-pet-hook.cjs"), "Packaged hook receiver"),
    requirePath(join(resourcesDirectory, "tray-icon.png"), "Packaged tray icon"),
    requirePath(
      join(resourcesDirectory, "pets", "example-original-pet", "manifest.json"),
      "Packaged built-in pet",
    ),
  ]);
  process.stdout.write(
    `${JSON.stringify({ packagedDirectory, executable, resourcesDirectory, platform: targetPlatform, arch: targetArch })}\n`,
  );
} finally {
  await rm(stagingDirectory, { recursive: true, force: true });
  const parent = join(root, "tmp");
  try {
    const entries = await readdir(parent);
    if (!entries.length) await rm(parent, { force: true });
  } catch {
    // The temporary parent may be absent or retained by another ignored verifier.
  }
}
