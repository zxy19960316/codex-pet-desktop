import { app, BrowserWindow } from "electron";
import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

const outputDirectory = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!outputDirectory) throw new Error("Synthetic pet output directory is required");
await mkdir(outputDirectory, { recursive: true });
const runtimeDirectory = resolve(outputDirectory, "..", ".synthetic-electron-runtime");
await mkdir(runtimeDirectory, { recursive: true });
app.setPath("userData", runtimeDirectory);
app.commandLine.appendSwitch("disable-gpu");

app
  .whenReady()
  .then(async () => {
    const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      await window.loadURL("data:text/html,<meta charset=utf-8><title>Synthetic Pet</title>");
      const dataUrl = await window.webContents.executeJavaScript(`(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1536;
      canvas.height = 1872;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D is unavailable');
      context.clearRect(0, 0, canvas.width, canvas.height);
      const colors = ['#56cfe1', '#72efdd', '#80ffdb', '#64dfdf'];
      for (let row = 0; row < 9; row += 1) {
        for (let column = 0; column < 8; column += 1) {
          const x = column * 192;
          const y = row * 208;
          context.fillStyle = colors[(row + column) % colors.length];
          context.fillRect(x + 54, y + 62, 84, 94);
          context.fillStyle = '#243b53';
          context.fillRect(x + 67, y + 84, 16, 16);
          context.fillRect(x + 109, y + 84, 16, 16);
          context.fillStyle = '#f8f9fa';
          context.fillRect(x + 73, y + 90, 5, 5);
          context.fillRect(x + 115, y + 90, 5, 5);
          context.fillStyle = '#5c677d';
          context.fillRect(x + 77 + ((column % 3) - 1) * 3, y + 126, 38, 8);
          context.fillStyle = '#ffd166';
          context.fillRect(x + 86, y + 43 + (row % 2) * 4, 20, 19);
        }
      }
      return canvas.toDataURL('image/webp', 0.92);
    })()`);
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/webp;base64,"))
        throw new Error("Chromium did not encode a WebP fixture");
      await writeFile(
        join(outputDirectory, "spritesheet.webp"),
        Buffer.from(dataUrl.split(",")[1], "base64"),
      );
      await writeFile(
        join(outputDirectory, "pet.json"),
        `${JSON.stringify(
          {
            id: "synthetic-geo",
            displayName: "Synthetic Geo Bot",
            description: "Original geometric robot generated for packaged verification.",
            spritesheetPath: "spritesheet.webp",
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    } finally {
      window.destroy();
      app.quit();
    }
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    app.exit(1);
  });
