import process from "node:process";

const required = ["WIN_CSC_LINK", "WIN_CSC_KEY_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  process.stderr.write(`Missing required Windows signing environment: ${missing.join(", ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Windows signing environment is configured. Secret values were not read.\n");
}
