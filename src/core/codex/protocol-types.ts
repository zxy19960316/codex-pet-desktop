export type JsonRpcId = string | number;

export interface JsonRpcTransport {
  writeLine(line: string): void;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export type JsonObject = Record<string, unknown>;
