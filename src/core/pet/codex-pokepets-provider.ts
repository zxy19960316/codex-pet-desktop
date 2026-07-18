import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  canonicalCodexPokePetId,
  type CodexPokePetsAdapter,
} from "./adapters/codex-pokepets-adapter";
import type {
  CodexPokePetDiscovery,
  CodexPokePetsDiscoverySnapshot,
} from "./adapters/codex-pokepets-types";
import type { PetPackage } from "./pet-manifest";
import type { PetRegistry } from "./pet-registry";

export interface CodexPokePetsProviderOptions {
  sourceDirectory: string;
  registry: PetRegistry;
  adapter: CodexPokePetsAdapter;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown compatibility error";
  return message.replace(/[A-Za-z]:[\\/][^\s;]+|\/(?:Users|home)\/[^\s;]+/gi, "<local path>");
}

export class CodexPokePetsProvider {
  readonly #sourceDirectory: string;
  readonly #registry: PetRegistry;
  readonly #adapter: CodexPokePetsAdapter;
  #snapshot: CodexPokePetsDiscoverySnapshot = { rootAvailable: false, pets: [] };

  constructor(options: CodexPokePetsProviderOptions) {
    this.#sourceDirectory = resolve(options.sourceDirectory);
    this.#registry = options.registry;
    this.#adapter = options.adapter;
  }

  getSnapshot(): CodexPokePetsDiscoverySnapshot {
    return structuredClone(this.#snapshot);
  }

  async scan(): Promise<CodexPokePetsDiscoverySnapshot> {
    let entries;
    try {
      entries = await readdir(this.#sourceDirectory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.#snapshot = { rootAvailable: false, pets: [] };
        return this.getSnapshot();
      }
      throw error;
    }
    const pets: CodexPokePetDiscovery[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) continue;
      try {
        const source = await this.#adapter.inspect(join(this.#sourceDirectory, entry.name));
        pets.push({
          sourcePetId: source.sourcePetId,
          displayName: source.displayName,
          compatible: true,
          imported: Boolean(this.#registry.getPet(canonicalCodexPokePetId(source.sourcePetId))),
          thirdParty: true,
        });
      } catch (error) {
        pets.push({
          sourcePetId: entry.name,
          displayName: entry.name,
          compatible: false,
          imported: false,
          thirdParty: true,
          error: safeError(error),
        });
      }
    }
    pets.sort((left, right) => left.displayName.localeCompare(right.displayName));
    this.#snapshot = { rootAvailable: true, pets };
    return this.getSnapshot();
  }

  async import(sourcePetId: string): Promise<PetPackage> {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourcePetId)) throw new Error("Invalid source pet id");
    const source = await this.#adapter.inspect(join(this.#sourceDirectory, sourcePetId));
    const imported = await this.#adapter.import(source);
    await this.scan();
    return imported;
  }
}
