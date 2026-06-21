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
  error?: {
    message?: string;
    code?: string;
    stackTrace?: string;
  };
  queryParams?: Record<string, string>;
  timestamp?: string;
  rawContext?: string;
  confidence: number;
}

export interface ApiFieldHit {
  keyword: string;
  value: unknown;
  path: string[];
  depth: number;
}

export interface UserDetail {
  id: string;
  /** Category of the finding */
  type: 'bearer_token' | 'email' | 'phone' | 'ip_address' | 'user_id' | 'username' | 'api_key' | 'session_id';
  /** The raw extracted value */
  value: string;
  /** Human-readable label (e.g., the JSON key it was found under) */
  label?: string;
  /** Source line numbers where this was found */
  sourceLines: number[];
  /** JSON path if found inside a parsed JSON */
  jsonPath?: string;
  /** For bearer tokens: decoded JWT payload (base64-decoded, not verified) */
  jwtPayload?: Record<string, unknown>;
  /** For bearer tokens: the jwt.io debug URL */
  jwtInspectUrl?: string;
  /** Confidence: high if found via exact keyword match, medium if regex-only */
  confidence: 'high' | 'medium';
  /** Raw context line for jump-to-source */
  rawContext?: string;
}
