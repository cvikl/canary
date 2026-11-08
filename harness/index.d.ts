export interface ServerHandle { readonly pid: number; close(): void; }
/** Start an MCP server over stdio. cmd is resolved on PATH inside the sandbox. */
export function startServer(cmd: string, args?: string[]): Promise<ServerHandle>;
/** Send a JSON-RPC request and await the result. Throws on JSON-RPC error or timeout. */
export function request(handle: ServerHandle, method: string, params?: unknown): Promise<unknown>;
/** Send a JSON-RPC notification. No reply is awaited. */
export function notify(handle: ServerHandle, method: string, params?: unknown): Promise<void>;
/** Assert a value against a small JSON-schema subset (type, required, properties, items, enum, const, minItems). Throws on mismatch. */
export function assertSchema(value: unknown, schema: object): void;
