declare module 'pg' {
  export class Pool {
    constructor(config?: { connectionString?: string });
    query(text: string, params?: unknown[]): Promise<{ rowCount?: number }>;
    connect(): Promise<{
      query: (text: string, params?: unknown[]) => Promise<{ rowCount?: number }>;
      release: () => void;
    }>;
    end(): Promise<void>;
  }
}
