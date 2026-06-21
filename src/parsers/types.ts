export interface ExtractedJson {
  id: string;
  raw: string;
  parsed: unknown;
  location: {
    startLine: number;
    endLine: number;
    startCol: number;
    endCol: number;
  };
  isNested: boolean;
  isEscaped: boolean;
  isIncomplete: boolean;
  context: string;
}

export interface ApiDetail {
  id: string;
  method?: string;
  url?: string;
  statusCode?: number;
  headers?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  latency?: string;
  sourceLines: number[];
}
