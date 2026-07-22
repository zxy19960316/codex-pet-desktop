declare module "pngjs" {
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(value: Buffer): PNG;
      write(value: PNG): Buffer;
    };
  }
}
