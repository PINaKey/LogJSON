/* eslint-disable no-useless-escape */
import { type ExtractedJson, type UserDetail } from './types';

function generateId(): string {
    return `user_${Math.random().toString(36).substring(2, 11)}`;
}

// ─── Regex patterns for line-by-line scanning ───

const BEARER_TOKEN_REGEX =
    /\bBearer\s+([A-Za-z0-9\-_\.]+(?:\.[A-Za-z0-9\-_\.]+)*)/gi;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const PHONE_REGEX =
    /((?:\+?1[-.\s]*)?(?:\(\d{3}\)|(?<!\d)\d{3})[-.\s]*\d{3}[-.\s]*\d{4}\b|(?:(?:\+|0)?91[-.\s]*)?(?<!\d)\d{10}\b)/g;
const IPV4_REGEX =
    /\b(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\b/g;
const API_KEY_REGEX =
    /(?:api[_-]?key|x-api-key|apikey)\s*[:=]\s*["']?([A-Za-z0-9\-_]{16,})["']?/gi;

// IPs to ignore (common non-useful values)
const IGNORED_IPS = new Set(['0.0.0.0', '127.0.0.1', '255.255.255.255']);

// Version-like patterns to exclude from IP matching
function looksLikeVersion(ip: string, context: string): boolean {
    // Check if the IP appears in a version-like context
    const idx = context.indexOf(ip);
    if (idx === -1) return false;
    const before = context.substring(Math.max(0, idx - 15), idx).toLowerCase();
    return /(?:version|ver|v|http\/)\s*[:=]?\s*$/.test(before);
}

// ─── Keyword map for structured JSON scanning ───

const USER_KEYWORD_MAP: Record<UserDetail['type'], string[]> = {
    email: [
        'email',
        'emailaddress',
        'email_address',
        'useremail',
        'user_email',
        'mail',
        'e-mail',
        'fromemail',
        'from_email',
        'toemail',
        'to_email',
    ],
    user_id: [
        'userid',
        'user_id',
        'uid',
        'sub',
        'subject',
        'accountid',
        'account_id',
        'customerid',
        'customer_id',
        'ownerid',
        'owner_id',
        'memberid',
        'member_id',
    ],
    username: ['username', 'user_name', 'login', 'displayname', 'display_name'],
    bearer_token: [
        'authorization',
        'token',
        'accesstoken',
        'access_token',
        'bearertoken',
        'bearer_token',
        'idtoken',
        'id_token',
        'refreshtoken',
        'refresh_token',
        'jwttoken',
        'jwt_token',
        'jwt',
    ],
    session_id: [
        'sessionid',
        'session_id',
        'sid',
        'sessiontoken',
        'session_token',
    ],
    api_key: [
        'apikey',
        'api_key',
        'x-api-key',
        'secret',
        'clientsecret',
        'client_secret',
        'secretkey',
        'secret_key',
    ],
    phone: [
        'phone',
        'phonenumber',
        'phone_number',
        'mobile',
        'mobilenumber',
        'mobile_number',
        'tel',
        'telephone',
    ],
    ip_address: [
        'ip',
        'ipaddress',
        'ip_address',
        'clientip',
        'client_ip',
        'remoteaddr',
        'remote_addr',
        'sourceip',
        'source_ip',
        'x-forwarded-for',
    ],
};

function getCategoryForKey(key: string): UserDetail['type'] | null {
    const lower = key.toLowerCase();
    for (const [category, keywords] of Object.entries(USER_KEYWORD_MAP)) {
        if (keywords.includes(lower)) {
            return category as UserDetail['type'];
        }
    }
    return null;
}

// ─── JWT decoding ───

function isJwtFormat(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    // Each part should be base64url encoded. The signature (parts[2]) can be empty.
    return parts.every(
        (p, idx) => (idx === 2 && p.length === 0) || (p.length > 0 && /^[A-Za-z0-9\-_]+={0,2}$/.test(p)),
    );
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1];
        // Base64url to base64
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const decoded = atob(padded);
        const parsed = JSON.parse(decoded);
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed as Record<string, unknown>;
        }
        return null;
    } catch {
        return null;
    }
}

function buildJwtInspectUrl(token: string): string {
    return `https://jwt.io/#debugger-io?token=${encodeURIComponent(token)}`;
}

// ─── Core extraction logic ───

interface RawFinding {
    type: UserDetail['type'];
    value: string;
    label?: string;
    sourceLine: number;
    jsonPath?: string;
    rawContext?: string;
    confidence: 'high' | 'medium';
}

function extractFromRegex(lines: string[]): RawFinding[] {
    const findings: RawFinding[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Bearer tokens
        let match: RegExpExecArray | null;
        BEARER_TOKEN_REGEX.lastIndex = 0;
        while ((match = BEARER_TOKEN_REGEX.exec(line)) !== null) {
            findings.push({
                type: 'bearer_token',
                value: match[1].trim().replace(/^["']|["']$/g, ''),
                label: 'Bearer Token',
                sourceLine: lineNum,
                rawContext:
                    line.length > 200 ? line.substring(0, 200) + '...' : line,
                confidence: 'high',
            });
        }

        // Emails
        EMAIL_REGEX.lastIndex = 0;
        while ((match = EMAIL_REGEX.exec(line)) !== null) {
            findings.push({
                type: 'email',
                value: match[0],
                sourceLine: lineNum,
                rawContext:
                    line.length > 200 ? line.substring(0, 200) + '...' : line,
                confidence: 'medium',
            });
        }

        // Phone numbers
        PHONE_REGEX.lastIndex = 0;
        while ((match = PHONE_REGEX.exec(line)) !== null) {
            const phone = match[1].trim();
            findings.push({
                type: 'phone',
                value: phone,
                sourceLine: lineNum,
                rawContext:
                    line.length > 200
                        ? line.substring(0, 200) + '...'
                        : line,
                confidence: 'high',
            });
        }

        // IP addresses
        IPV4_REGEX.lastIndex = 0;
        while ((match = IPV4_REGEX.exec(line)) !== null) {
            const ip = match[0];
            if (!IGNORED_IPS.has(ip) && !looksLikeVersion(ip, line)) {
                findings.push({
                    type: 'ip_address',
                    value: ip,
                    sourceLine: lineNum,
                    rawContext:
                        line.length > 200
                            ? line.substring(0, 200) + '...'
                            : line,
                    confidence: 'medium',
                });
            }
        }

        // API keys
        API_KEY_REGEX.lastIndex = 0;
        while ((match = API_KEY_REGEX.exec(line)) !== null) {
            findings.push({
                type: 'api_key',
                value: match[1],
                label: 'API Key',
                sourceLine: lineNum,
                rawContext:
                    line.length > 200 ? line.substring(0, 200) + '...' : line,
                confidence: 'high',
            });
        }
    }

    return findings;
}

function extractFromJson(extractedJsons: ExtractedJson[]): RawFinding[] {
    const findings: RawFinding[] = [];
    const visited = new WeakSet();

    function walk(
        obj: unknown,
        path: string[],
        sourceLine: number,
        depth: number,
    ): void {
        if (depth > 15) return;
        if (obj === null || typeof obj !== 'object') return;
        if (visited.has(obj as object)) return;
        visited.add(obj as object);

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                walk(obj[i], [...path, String(i)], sourceLine, depth + 1);
            }
        } else {
            const record = obj as Record<string, unknown>;
            for (const [key, val] of Object.entries(record)) {
                const category = getCategoryForKey(key);
                if (category && val !== undefined && val !== null) {
                    const strVal = typeof val === 'string' ? val : String(val);
                    if (strVal.trim().length > 0) {
                        // For authorization headers, extract the bearer token value
                        if (
                            category === 'bearer_token' &&
                            typeof val === 'string'
                        ) {
                            const bearerMatch = val.match(/^Bearer\s+(.+)$/i);
                            const tokenVal = (bearerMatch ? bearerMatch[1] : val).trim().replace(/^["']|["']$/g, '');
                            findings.push({
                                type: 'bearer_token',
                                value: tokenVal,
                                label: key,
                                sourceLine,
                                jsonPath: [...path, key].join('.'),
                                confidence: 'high',
                            });
                        } else {
                            findings.push({
                                type: category,
                                value: strVal,
                                label: key,
                                sourceLine,
                                jsonPath: [...path, key].join('.'),
                                confidence: 'high',
                            });
                        }
                    }
                }
                if (val !== null && typeof val === 'object') {
                    walk(val, [...path, key], sourceLine, depth + 1);
                }
            }
        }
    }

    const topLevelJsons = extractedJsons.filter((j) => !j.isNested);
    for (const json of topLevelJsons) {
        walk(json.parsed, [], json.location.startLine, 0);
    }

    return findings;
}

function deduplicateFindings(findings: RawFinding[]): UserDetail[] {
    const map = new Map<string, UserDetail>();

    for (const f of findings) {
        const dedupeKey = `${f.type}::${f.value}`;

        if (map.has(dedupeKey)) {
            const existing = map.get(dedupeKey)!;
            if (!existing.sourceLines.includes(f.sourceLine)) {
                existing.sourceLines.push(f.sourceLine);
                existing.sourceLines.sort((a, b) => a - b);
            }
            // Prefer high confidence
            if (f.confidence === 'high') existing.confidence = 'high';
            // Prefer labeled findings
            if (f.label && !existing.label) existing.label = f.label;
            if (f.jsonPath && !existing.jsonPath)
                existing.jsonPath = f.jsonPath;
            if (f.rawContext && !existing.rawContext)
                existing.rawContext = f.rawContext;
        } else {
            const detail: UserDetail = {
                id: generateId(),
                type: f.type,
                value: f.value,
                label: f.label,
                sourceLines: [f.sourceLine],
                jsonPath: f.jsonPath,
                confidence: f.confidence,
                rawContext: f.rawContext,
            };

            // JWT processing for bearer tokens
            if (f.type === 'bearer_token') {
                detail.jwtInspectUrl = buildJwtInspectUrl(f.value);
                if (isJwtFormat(f.value)) {
                    detail.jwtPayload = decodeJwtPayload(f.value) ?? undefined;
                }
            }

            map.set(dedupeKey, detail);
        }
    }

    return Array.from(map.values());
}

// ─── Public API ───

export function extractUserDetails(
    text: string,
    extractedJsons: ExtractedJson[],
): UserDetail[] {
    const lines = text.split(/\r?\n/);

    const regexFindings = extractFromRegex(lines);
    const jsonFindings = extractFromJson(extractedJsons);

    const allFindings = [...regexFindings, ...jsonFindings];
    const deduped = deduplicateFindings(allFindings);

    // Sort: bearer_tokens first, then by type, then by first source line
    const typeOrder: Record<UserDetail['type'], number> = {
        bearer_token: 0,
        api_key: 1,
        email: 2,
        user_id: 3,
        username: 4,
        session_id: 5,
        phone: 6,
        ip_address: 7,
    };

    return deduped.sort((a, b) => {
        const typeCompare =
            (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99);
        if (typeCompare !== 0) return typeCompare;
        return a.sourceLines[0] - b.sourceLines[0];
    });
}
