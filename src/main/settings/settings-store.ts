import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { cloneSettingsDocument, type SettingsDocumentV2 } from "../../shared/settings";
import {
  InvalidSettingsDocumentError,
  MigrationRegistry,
  UnsupportedSettingsVersionError,
} from "./settings-migrations";

export type SettingsLoadState =
  | { kind: "missing" }
  | { kind: "loaded"; schemaVersion: 2 }
  | { kind: "migrated"; sourceVersion: 1 }
  | { kind: "corrupt" }
  | { kind: "future-version"; schemaVersion: number };

export interface SettingsStoreReadResult {
  document: SettingsDocumentV2;
  loadState: SettingsLoadState;
  writable: boolean;
}

export interface SettingsFileOperations {
  mkdir(path: string): Promise<unknown>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, value: string): Promise<unknown>;
  rename(from: string, to: string): Promise<unknown>;
  rm(path: string): Promise<unknown>;
}

export interface SettingsStoreOptions {
  legacyPath: string;
  v2Path: string;
  operations?: Partial<SettingsFileOperations>;
}

const DEFAULT_OPERATIONS: SettingsFileOperations = {
  mkdir: (path) => mkdir(path, { recursive: true }),
  readFile: (path) => readFile(path, "utf8"),
  writeFile: (path, value) => writeFile(path, value, { encoding: "utf8", mode: 0o600 }),
  rename,
  rm: (path) => rm(path, { force: true }),
};

let temporarySequence = 0;

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function futureVersion(error: UnsupportedSettingsVersionError): number | undefined {
  return typeof error.schemaVersion === "number" &&
    Number.isFinite(error.schemaVersion) &&
    error.schemaVersion > 2
    ? error.schemaVersion
    : undefined;
}

export class SettingsStore {
  readonly #legacyPath: string;
  readonly #v2Path: string;
  readonly #operations: SettingsFileOperations;
  readonly #migrations: MigrationRegistry;

  constructor(options: SettingsStoreOptions, migrations = new MigrationRegistry()) {
    this.#legacyPath = options.legacyPath;
    this.#v2Path = options.v2Path;
    this.#operations = { ...DEFAULT_OPERATIONS, ...options.operations };
    this.#migrations = migrations;
  }

  async read(): Promise<SettingsStoreReadResult> {
    let raw: string;
    try {
      raw = await this.#operations.readFile(this.#v2Path);
    } catch (error) {
      if (!isMissing(error)) throw error;
      return this.#readLegacy();
    }

    try {
      return {
        document: this.#migrations.migrate(JSON.parse(raw)),
        loadState: { kind: "loaded", schemaVersion: 2 },
        writable: true,
      };
    } catch (error) {
      if (error instanceof UnsupportedSettingsVersionError) {
        const schemaVersion = futureVersion(error);
        if (schemaVersion !== undefined)
          return {
            document: this.#migrations.defaults(),
            loadState: { kind: "future-version", schemaVersion },
            writable: false,
          };
        return {
          document: this.#migrations.defaults(),
          loadState: { kind: "corrupt" },
          writable: false,
        };
      }
      if (error instanceof SyntaxError || error instanceof InvalidSettingsDocumentError) {
        return {
          document: this.#migrations.defaults(),
          loadState: { kind: "corrupt" },
          writable: false,
        };
      }
      throw error;
    }
  }

  async write(document: Readonly<SettingsDocumentV2>): Promise<void> {
    await this.#operations.mkdir(dirname(this.#v2Path));
    temporarySequence += 1;
    const temporary = `${this.#v2Path}.${process.pid}.${Date.now()}.${temporarySequence}.tmp`;
    try {
      await this.#operations.writeFile(
        temporary,
        `${JSON.stringify(cloneSettingsDocument(document), null, 2)}\n`,
      );
      await this.#operations.rename(temporary, this.#v2Path);
    } catch (error) {
      await this.#operations.rm(temporary).catch(() => undefined);
      throw error;
    }
  }

  async #readLegacy(): Promise<SettingsStoreReadResult> {
    let raw: string;
    try {
      raw = await this.#operations.readFile(this.#legacyPath);
    } catch (error) {
      if (isMissing(error))
        return {
          document: this.#migrations.defaults(),
          loadState: { kind: "missing" },
          writable: true,
        };
      throw error;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const document = this.#migrations.migrate(parsed);
      await this.write(document);
      return {
        document,
        loadState: { kind: "migrated", sourceVersion: 1 },
        writable: true,
      };
    } catch (error) {
      if (error instanceof UnsupportedSettingsVersionError) {
        const schemaVersion = futureVersion(error);
        if (schemaVersion !== undefined)
          return {
            document: this.#migrations.defaults(),
            loadState: { kind: "future-version", schemaVersion },
            writable: false,
          };
        return {
          document: this.#migrations.defaults(),
          loadState: { kind: "corrupt" },
          writable: false,
        };
      }
      if (error instanceof SyntaxError || error instanceof InvalidSettingsDocumentError)
        return {
          document: this.#migrations.defaults(),
          loadState: { kind: "corrupt" },
          writable: false,
        };
      throw error;
    }
  }
}
