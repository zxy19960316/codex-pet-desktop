declare module "pngjs" {
  export class PNG {
    constructor(options?: { width?: number; height?: number });
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(value: Buffer): PNG;
      write(value: PNG): Buffer;
    };
  }
}
