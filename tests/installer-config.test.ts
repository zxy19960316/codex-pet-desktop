import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);

describe("Windows installer configuration", () => {
  it("keeps installation per-user, explicit, local, and non-publishing", async () => {
    const config = JSON.parse(await readFile(join(process.cwd(), "electron-builder.json"), "utf8"));
    expect(config).toMatchObject({
      appId: "io.github.zxy19960316.codexpetdesktop",
      asar: true,
      compression: "maximum",
      directories: { output: "release/m3-3", buildResources: "build/generated" },
      files: ["dist/**/*", "package.json"],
      extraResources: [
        { from: "pets", to: "pets", filter: ["**/*"] },
        { from: "dist/hook/codex-pet-hook.cjs", to: "codex-pet-hook.cjs" },
        { from: "build/generated/tray-icon.png", to: "tray-icon.png" },
        { from: "LICENSE", to: "LICENSE" },
        { from: "THIRD_PARTY_NOTICES.md", to: "THIRD_PARTY_NOTICES.md" },
      ],
      publish: null,
      win: {
        icon: "build/generated/icon.ico",
        executableName: "Codex Pet Desktop",
        artifactName: "codex-pet-desktop-${version}-setup-${arch}.${ext}",
        forceCodeSigning: false,
        target: [{ target: "nsis", arch: ["x64"] }],
      },
      nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        runAfterFinish: false,
      },
    });
  });

  it("keeps license notices in the unpacked application as well", async () => {
    const script = await readFile(join(process.cwd(), "scripts", "package-app.mjs"), "utf8");

    expect(script).toContain('const licensePath = join(root, "LICENSE")');
    expect(script).toContain('const thirdPartyNoticesPath = join(root, "THIRD_PARTY_NOTICES.md")');
    expect(script).toContain('join(resourcesDirectory, "LICENSE")');
    expect(script).toContain('join(resourcesDirectory, "THIRD_PARTY_NOTICES.md")');
  });

  it("requires both signing secrets without printing either value", async () => {
    const script = join(process.cwd(), "scripts", "require-windows-signing.mjs");
    const missingEnvironment = { ...process.env };
    delete missingEnvironment.WIN_CSC_LINK;
    delete missingEnvironment.WIN_CSC_KEY_PASSWORD;
    await expect(run(process.execPath, [script], { env: missingEnvironment })).rejects.toThrow(
      "WIN_CSC_LINK, WIN_CSC_KEY_PASSWORD",
    );

    const link = "secret-certificate-value";
    const password = "secret-password-value";
    const result = await run(process.execPath, [script], {
      env: { ...process.env, WIN_CSC_LINK: link, WIN_CSC_KEY_PASSWORD: password },
    });
    expect(result.stdout).toContain("Windows signing environment is configured");
    expect(`${result.stdout}${result.stderr}`).not.toContain(link);
    expect(`${result.stdout}${result.stderr}`).not.toContain(password);
  });
});
