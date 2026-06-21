/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-useless-escape */
import { type ApiDetail, type ExtractedJson, type ApiFieldHit } from './types';

function generateId(): string {
    return `api_${Math.random().toString(36).substring(2, 11)}`;
}

const METHOD_URL_REGEX =
    /\b(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b\s+["']?(https?:\/\/[^\s"']+|(?:(?:\/[a-zA-Z0-9_\-\.\\~%]+)+)\/?(?:\?[^\s"']*)?)['"']?/i;

const STATUS_CODE_REGEXES = [
    /\bstatus(?:_?code)?[:= ]*([1-5]\d{2})\b/i,
    /\bHTTP\/1\.[012]"\s+([1-5]\d{2})\b/i,
    /\b(?:sent|returned)\s+([1-5]\d{2})\b/i,
    /\b([1-5]\d{2})\s+OK\b/i,
    /\bstatus\s+([1-5]\d{2})\b/i,
];

const LATENCY_REGEXES = [
    /\btook\s*[:=]?\s*(\d+(?:\.\d+)?\s*(?:ms|s|milliseconds))\b/i,
    /\bduration\s*[:=]?\s*(\d+(?:\.\d+)?\s*(?:ms|s))\b/i,
    /\blatency\s*[:=]?\s*(\d+(?:\.\d+)?\s*(?:ms|s))\b/i,
    /\b(\d+(?:\.\d+)?\s*ms)\b/i,
    /\b(\d+\.\d+\s*s)\b/i,
];

function tryParseJsonString(str: unknown): unknown | null {
    if (typeof str !== 'string') return null;
    const trimmed = str.trim();
    if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
        try {
            return JSON.parse(trimmed);
        } catch {
            try {
                return JSON.parse(trimmed.replace(/\\\//g, '/'));
            } catch {
                return null;
            }
        }
    }
    return null;
}

// ---------------------------------------------------------
// NEW KEYWORD SCANNER AND CLUSTERING
// ---------------------------------------------------------

const KEYWORD_MAP: Record<string, string[]> = {
    method: [
        'method',
        'httpmethod',
        'http_method',
        'requestmethod',
        'request_method',
    ],
    url: [
        'url',
        'uri',
        'endpoint',
        'path',
        'href',
        'requesturl',
        'request_url',
        'requesturi',
        'request_uri',
        'resource',
    ],
    status: [
        'status',
        'statuscode',
        'status_code',
        'httpstatus',
        'http_status',
        'responsecode',
        'response_code',
    ],
    requestBody: [
        'body',
        'requestbody',
        'request_body',
        'payload',
        'requestpayload',
        'request_payload',
        'params',
        'input',
    ],
    responseBody: [
        'responsebody',
        'response_body',
        'responsepayload',
        'response_payload',
        'result',
        'output',
    ],
    headers: [
        'headers',
        'requestheaders',
        'request_headers',
        'responseheaders',
        'response_headers',
    ],
    latency: [
        'duration',
        'durationms',
        'duration_ms',
        'latency',
        'responsetime',
        'response_time',
        'elapsed',
        'took',
        'time',
        'elapsedms',
        'elapsed_ms',
    ],
    error: [
        'error',
        'errormessage',
        'error_message',
        'exception',
        'fault',
        'errorcode',
        'error_code',
        'stacktrace',
        'stack_trace',
        'stack',
    ],
    timestamp: [
        'timestamp',
        'datetime',
        'date',
        'createdat',
        'created_at',
        'requesttime',
        'request_time',
    ],
    queryParams: [
        'queryparams',
        'query_params',
        'querystring',
        'query_string',
        'searchparams',
        'search_params',
        'qs',
    ],
};

function getCategoryForKeyword(key: string): string | null {
    const lower = key.toLowerCase();
    for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
        if (keywords.includes(lower)) {
            return category;
        }
    }
    if (lower === 'data') return 'data'; // special case
    return null;
}

function scanForApiFields(
    obj: unknown,
    path: string[],
    depth: number,
    hits: ApiFieldHit[],
    visited: WeakSet<any>,
): void {
    if (depth > 15) return;
    if (obj === null || typeof obj !== 'object') return;

    if (visited.has(obj)) return;
    visited.add(obj);

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            scanForApiFields(
                obj[i],
                [...path, String(i)],
                depth + 1,
                hits,
                visited,
            );
        }
    } else {
        const record = obj as Record<string, unknown>;
        for (const [key, val] of Object.entries(record)) {
            const category = getCategoryForKeyword(key);
            if (category) {
                hits.push({
                    keyword: category,
                    value: val,
                    path: [...path, key],
                    depth,
                });
            }
            if (val !== null && typeof val === 'object') {
                const lowerKey = key.toLowerCase();
                const isWrapper = [
                    'req',
                    'request',
                    'res',
                    'response',
                    'error',
                    'headers',
                    'data',
                    'payload',
                    'body',
                    'metadata',
                    'meta',
                    'details',
                ].includes(lowerKey);
                scanForApiFields(
                    val,
                    isWrapper ? path : [...path, key],
                    depth + 1,
                    hits,
                    visited,
                );
            }
        }
    }
}

function clusterApiFields(hits: ApiFieldHit[]): ApiFieldHit[][] {
    const clusters: Record<string, ApiFieldHit[]> = {};

    for (const hit of hits) {
        const path = hit.path.slice(0, -1);
        while (path.length > 0) {
            const last = path[path.length - 1].toLowerCase();
            if (
                [
                    'req',
                    'request',
                    'res',
                    'response',
                    'error',
                    'headers',
                    'data',
                    'payload',
                    'body',
                    'metadata',
                    'meta',
                    'details',
                ].includes(last)
            ) {
                path.pop();
            } else {
                break;
            }
        }
        const parentPath = path.join('.');
        if (!clusters[parentPath]) {
            clusters[parentPath] = [];
        }
        clusters[parentPath].push(hit);
    }

    return Object.values(clusters);
}

function buildApiDetail(
    cluster: ApiFieldHit[],
    sourceLines: number[],
): ApiDetail | null {
    const api: Partial<ApiDetail> = {
        id: generateId(),
        sourceLines,
        confidence: 0,
    };

    let confidence = 0;
    let urlFound = false;
    let statusFound = false;

    for (const hit of cluster) {
        const cat = hit.keyword;
        const val = hit.value;

        if (cat === 'url' && typeof val === 'string' && !api.url) {
            api.url = val;
            confidence += 0.4;
            urlFound = true;
        } else if (cat === 'method' && typeof val === 'string' && !api.method) {
            api.method = val.toUpperCase();
            confidence += 0.2;
        } else if (cat === 'status' && !api.statusCode) {
            let code: number | undefined;
            if (typeof val === 'number') code = val;
            else if (typeof val === 'string') {
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed >= 100 && parsed < 600)
                    code = parsed;
            }
            if (code) {
                api.statusCode = code;
                confidence += 0.2;
                statusFound = true;
            }
        } else if (cat === 'requestBody' && !api.requestBody) {
            api.requestBody = tryParseJsonString(val) || val;
            confidence += 0.1;
        } else if (cat === 'responseBody' && !api.responseBody) {
            api.responseBody = tryParseJsonString(val) || val;
            confidence += 0.1;
        } else if (
            cat === 'headers' &&
            val &&
            typeof val === 'object' &&
            !api.headers
        ) {
            api.headers = val as Record<string, string>;
            confidence += 0.05;
        } else if (cat === 'latency' && !api.latency) {
            if (typeof val === 'number') api.latency = `${val}ms`;
            else if (typeof val === 'string') api.latency = val;
        } else if (cat === 'error') {
            api.error = api.error || {};
            if (typeof val === 'string') {
                if (
                    hit.path[hit.path.length - 1]
                        .toLowerCase()
                        .includes('stack')
                ) {
                    api.error.stackTrace = val;
                } else if (
                    hit.path[hit.path.length - 1].toLowerCase().includes('code')
                ) {
                    api.error.code = val;
                } else {
                    api.error.message = val;
                }
            } else if (val && typeof val === 'object') {
                const errObj = val as Record<string, unknown>;
                api.error.message = (errObj['message'] ||
                    errObj['errorMessage']) as string;
                api.error.code = (errObj['code'] ||
                    errObj['errorCode']) as string;
                api.error.stackTrace = (errObj['stackTrace'] ||
                    errObj['stack']) as string;
            }
            confidence += 0.05;
        } else if (
            cat === 'timestamp' &&
            typeof val === 'string' &&
            !api.timestamp
        ) {
            api.timestamp = val;
        } else if (
            cat === 'queryParams' &&
            val &&
            typeof val === 'object' &&
            !api.queryParams
        ) {
            api.queryParams = val as Record<string, string>;
        } else if (cat === 'data') {
            if (statusFound && !api.responseBody) {
                api.responseBody = tryParseJsonString(val) || val;
            } else if (urlFound && !api.requestBody) {
                api.requestBody = tryParseJsonString(val) || val;
            }
        }
    }

    api.confidence = confidence;

    if (confidence >= 0.3) {
        return api as ApiDetail;
    }
    return null;
}

// ---------------------------------------------------------
// EXTRACTOR
// ---------------------------------------------------------

function extractRegexApis(
    lines: string[],
    extractedJsons: ExtractedJson[],
): ApiDetail[] {
    const apis: ApiDetail[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const methodUrlMatch = line.match(METHOD_URL_REGEX);
        if (!methodUrlMatch) continue;

        const method = methodUrlMatch[1].toUpperCase();
        const url = methodUrlMatch[2];

        let statusCode: number | undefined;
        for (const regex of STATUS_CODE_REGEXES) {
            const match = line.match(regex);
            if (match) {
                statusCode = parseInt(match[1], 10);
                break;
            }
        }

        let latency: string | undefined;
        for (const regex of LATENCY_REGEXES) {
            const match = line.match(regex);
            if (match) {
                latency = match[1];
                break;
            }
        }

        const nearbyJsons = extractedJsons.filter((json) => {
            const startLine = json.location.startLine;
            return startLine >= lineNum && startLine <= lineNum + 5;
        });

        let requestBody: unknown | undefined;
        let responseBody: unknown | undefined;
        let headers: Record<string, string> | undefined;

        if (nearbyJsons.length > 0) {
            const getIntermediateText = (jsonStartLine: number) => {
                return lines.slice(i, jsonStartLine).join('\n');
            };

            const requestJson = nearbyJsons.find((json) => {
                const ctx = getIntermediateText(json.location.startLine);
                return (
                    /request|payload|body|req/i.test(ctx) &&
                    !/response|res/i.test(ctx)
                );
            });
            const responseJson = nearbyJsons.find((json) => {
                const ctx = getIntermediateText(json.location.startLine);
                return /response|res|result|output/i.test(ctx);
            });

            if (requestJson) requestBody = requestJson.parsed;
            if (responseJson) responseBody = responseJson.parsed;

            if (!requestBody && !responseBody) {
                if (nearbyJsons.length === 1) {
                    const singleJson = nearbyJsons[0];
                    const isGetOrDelete =
                        method === 'GET' || method === 'DELETE';

                    const hasResponseKeys =
                        typeof singleJson.parsed === 'object' &&
                        singleJson.parsed !== null &&
                        ('statusCode' in singleJson.parsed ||
                            'status' in singleJson.parsed ||
                            'error' in singleJson.parsed ||
                            'data' in singleJson.parsed);

                    if (isGetOrDelete || hasResponseKeys) {
                        responseBody = singleJson.parsed;
                    } else {
                        if (['POST', 'PUT', 'PATCH'].includes(method))
                            requestBody = singleJson.parsed;
                        else responseBody = singleJson.parsed;
                    }
                } else if (nearbyJsons.length >= 2) {
                    requestBody = nearbyJsons[0].parsed;
                    responseBody = nearbyJsons[1].parsed;
                }
            }

            const headerJson = nearbyJsons.find((json) => {
                const ctx = getIntermediateText(json.location.startLine);
                return (
                    /headers|header/i.test(ctx) ||
                    (json.parsed !== null &&
                        typeof json.parsed === 'object' &&
                        ('content-type' in json.parsed ||
                            'authorization' in json.parsed ||
                            'Content-Type' in json.parsed))
                );
            });
            if (
                headerJson &&
                typeof headerJson.parsed === 'object' &&
                headerJson.parsed !== null
            ) {
                headers = headerJson.parsed as Record<string, string>;
            }
        }

        let confidence = 0.4;
        if (method) confidence += 0.2;
        if (statusCode) confidence += 0.2;
        if (requestBody) confidence += 0.1;
        if (responseBody) confidence += 0.1;

        apis.push({
            id: generateId(),
            method,
            url,
            statusCode,
            headers,
            requestBody,
            responseBody,
            latency,
            rawContext: line,
            confidence,
            sourceLines: [
                lineNum,
                ...nearbyJsons.map((j) => j.location.startLine),
            ],
        });
    }
    return apis;
}

function mergeApiDetails(
    regexApis: ApiDetail[],
    structuredApis: ApiDetail[],
): ApiDetail[] {
    const merged: ApiDetail[] = [];
    const usedStructured = new Set<string>();

    for (const regexApi of regexApis) {
        let bestMatch: ApiDetail | null = null;

        for (const sApi of structuredApis) {
            if (usedStructured.has(sApi.id)) continue;

            if (
                regexApi.url === sApi.url &&
                (regexApi.method === sApi.method || !sApi.method)
            ) {
                bestMatch = sApi;
                break;
            }

            if (
                regexApi.url &&
                sApi.url &&
                regexApi.url.split('?')[0] === sApi.url.split('?')[0]
            ) {
                bestMatch = sApi;
                break;
            }
        }

        if (bestMatch) {
            usedStructured.add(bestMatch.id);
            merged.push({
                ...regexApi,
                ...bestMatch,
                id: regexApi.id,
                method: bestMatch.method || regexApi.method,
                statusCode: bestMatch.statusCode || regexApi.statusCode,
                latency: bestMatch.latency || regexApi.latency,
                requestBody: bestMatch.requestBody || regexApi.requestBody,
                responseBody: bestMatch.responseBody || regexApi.responseBody,
                headers: bestMatch.headers || regexApi.headers,
                sourceLines: [
                    ...new Set([
                        ...regexApi.sourceLines,
                        ...bestMatch.sourceLines,
                    ]),
                ].sort((a, b) => a - b),
                confidence: Math.max(regexApi.confidence, bestMatch.confidence),
            });
        } else {
            merged.push(regexApi);
        }
    }

    for (const sApi of structuredApis) {
        if (!usedStructured.has(sApi.id)) {
            merged.push(sApi);
        }
    }

    return merged;
}

export function extractApiDetails(
    text: string,
    extractedJsons: ExtractedJson[],
): ApiDetail[] {
    const lines = text.split(/\r?\n/);

    const regexApis = extractRegexApis(lines, extractedJsons);

    const structuredApis: ApiDetail[] = [];
    const topLevelJsons = extractedJsons.filter((j) => !j.isNested);

    for (const json of topLevelJsons) {
        const hits: ApiFieldHit[] = [];
        scanForApiFields(json.parsed, [], 0, hits, new WeakSet());

        const clusters = clusterApiFields(hits);

        for (const cluster of clusters) {
            const api = buildApiDetail(cluster, [json.location.startLine]);
            if (api) {
                if (
                    !api.latency &&
                    typeof json.parsed === 'object' &&
                    json.parsed !== null
                ) {
                    const root = json.parsed as Record<string, unknown>;
                    if (typeof root['durationMs'] === 'number')
                        api.latency = `${root['durationMs']}ms`;
                    else if (typeof root['duration'] === 'number')
                        api.latency = `${root['duration']}ms`;
                }
                structuredApis.push(api);
            }
        }
    }

    return mergeApiDetails(regexApis, structuredApis).sort(
        (a, b) => a.sourceLines[0] - b.sourceLines[0],
    );
}
