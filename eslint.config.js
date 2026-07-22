import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "release/**", "tmp/**", "coverage/**", "node_modules/**", "user-pets/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["node:*"],
          paths: [
            { name: "electron", message: "Use the typed preload API instead." },
            { name: "fs", message: "Renderer cannot access Node.js." },
            { name: "path", message: "Renderer cannot access Node.js." },
          ],
        },
      ],
    },
  },
);
