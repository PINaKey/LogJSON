/* eslint-disable no-useless-escape */
import { type ApiDetail, type ExtractedJson } from './types';

function generateId(): string {
    return `api_${Math.random().toString(36).substring(2, 11)}`;
}

// Regex to detect HTTP Method and URL/Path
const METHOD_URL_REGEX =
    /\b(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b\s+["']?(https?:\/\/[^\s"']+|(?:(?:\/[a-zA-Z0-9_\-\.\~%]+)+)\/?(?:\?[^\s"']*)?)["']?/i;

// Regex to detect HTTP Status Codes
const STATUS_CODE_REGEXES = [
    /\bstatus(?:_?code)?[:= ]*([1-5]\d{2})\b/i, // status: 200, statusCode=404, status_code: 500
    /\bHTTP\/1\.[012]"\s+([1-5]\d{2})\b/i, // "POST /api HTTP/1.1" 200
    /\b(?:sent|returned)\s+([1-5]\d{2})\b/i, // returned 200
    /\b([1-5]\d{2})\s+OK\b/i, // 200 OK
    /\bstatus\s+([1-5]\d{2})\b/i,
];

// Regex to detect Latency / Duration
const LATENCY_REGEXES = [
    /\btook\s*[:=]?\s*(\d+(?:\.\d+)?\s*(?:ms|s|milliseconds))\b/i,
    /\bduration\s*[:=]?\s*(\d+(?:\.\d+)?\s*(?:ms|s))\b/i,
    /\blatency\s*[:=]?\s*(\d+(?:\.\d+)?\s*(?:ms|s))\b/i,
    /\b(\d+(?:\.\d+)?\s*ms)\b/i, // e.g. "45ms"
    /\b(\d+\.\d+\s*s)\b/i, // e.g. "1.24s"
];

/**
 * Extracts API details from text and correlates them with extracted JSONs.
 */
export function extractApiDetails(
    text: string,
    extractedJsons: ExtractedJson[],
): ApiDetail[] {
    const lines = text.split(/\r?\n/);
    const apis: ApiDetail[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1; // 1-indexed

        // 1. Detect Method and URL
        const methodUrlMatch = line.match(METHOD_URL_REGEX);
        if (!methodUrlMatch) continue;

        const method = methodUrlMatch[1].toUpperCase();
        const url = methodUrlMatch[2];

        // 2. Detect Status Code
        let statusCode: number | undefined;
        for (const regex of STATUS_CODE_REGEXES) {
            const match = line.match(regex);
            if (match) {
                statusCode = parseInt(match[1], 10);
                break;
            }
        }

        // 3. Detect Latency
        let latency: string | undefined;
        for (const regex of LATENCY_REGEXES) {
            const match = line.match(regex);
            if (match) {
                latency = match[1];
                break;
            }
        }

        // 4. Find correlated JSONs
        // Heuristic: Search for JSONs starting on this line or up to 5 lines below
        const nearbyJsons = extractedJsons.filter((json) => {
            const startLine = json.location.startLine;
            return startLine >= lineNum && startLine <= lineNum + 5;
        });

        let requestBody: unknown | undefined;
        let responseBody: unknown | undefined;

        // Check headers in nearby JSONs
        let headers: Record<string, string> | undefined;

        if (nearbyJsons.length > 0) {
            // Helper to get text from API line to the start of the JSON
            const getIntermediateText = (jsonStartLine: number) => {
                // lines is 0-indexed, so API line is index i (lineNum - 1).
                // jsonStartLine is 1-indexed, so we slice up to jsonStartLine (exclusive, since slice is exclusive).
                // This will include lines from the API line to the line containing the JSON start.
                return lines.slice(i, jsonStartLine).join('\n');
            };

            // If there are multiple JSONs nearby
            // Let's see if any JSON is labeled or contains request/response indicators
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

            if (requestJson) {
                requestBody = requestJson.parsed;
            }
            if (responseJson) {
                responseBody = responseJson.parsed;
            }

            // If we couldn't differentiate by context but have JSONs, make a guess:
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
                        if (['POST', 'PUT', 'PATCH'].includes(method)) {
                            requestBody = singleJson.parsed;
                        } else {
                            responseBody = singleJson.parsed;
                        }
                    }
                } else if (nearbyJsons.length >= 2) {
                    requestBody = nearbyJsons[0].parsed;
                    responseBody = nearbyJsons[1].parsed;
                }
            }

            // Extract headers if they look like a header block
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

        apis.push({
            id: generateId(),
            method,
            url,
            statusCode,
            headers,
            requestBody,
            responseBody,
            latency,
            sourceLines: [
                lineNum,
                ...nearbyJsons.map((j) => j.location.startLine),
            ],
        });
    }

    return apis;
}
