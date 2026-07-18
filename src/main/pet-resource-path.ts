import { resolve } from "node:path";

export interface PackagedPetPathInput {
  appPath: string;
  resourcesPath: string;
  isPackaged: boolean;
}

export function resolveBuiltinPetsDirectory(input: PackagedPetPathInput): string {
  return resolve(input.isPackaged ? input.resourcesPath : input.appPath, "pets");
}
