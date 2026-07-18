import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const packageDocument = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const filename = `codex-pet-desktop-${packageDocument.version}-setup-x64.exe`;
const installer = join(root, "release", "m3-3", filename);
const installerStat = await stat(installer);
if (!installerStat.isFile()) throw new Error(`Installer is not a file: ${installer}`);

const sha256 = createHash("sha256")
  .update(await readFile(installer))
  .digest("hex");
const checksum = `${installer}.sha256`;
await writeFile(checksum, `${sha256}  ${filename}\n`, "utf8");
process.stdout.write(
  `${JSON.stringify({ installer, checksum, sha256, size: installerStat.size })}\n`,
);
