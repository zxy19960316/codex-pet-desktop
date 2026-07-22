export interface LaunchAtLoginOptions {
  isPackaged: boolean;
  executablePath: string;
  setLoginItemSettings(settings: { openAtLogin: boolean; path: string }): void;
}

export class LaunchAtLoginController {
  readonly #options: LaunchAtLoginOptions;

  constructor(options: LaunchAtLoginOptions) {
    this.#options = options;
  }

  sync(enabled: boolean): void {
    if (!this.#options.isPackaged) return;
    this.#options.setLoginItemSettings({
      openAtLogin: enabled,
      path: this.#options.executablePath,
    });
  }
}
