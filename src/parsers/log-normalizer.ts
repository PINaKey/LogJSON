/* eslint-disable no-useless-escape */
export interface NormalizedLine {
    originalIndex: number; // 0-indexed line number in the original text
    originalText: string;
    normalizedText: string;
    metadata?: {
        timestamp?: string;
        level?: string;
        requestId?: string;
        prefix?: string; // everything stripped from the start
    };
}

// Regexes to match common log prefixes
const TIMESTAMP_REGEX =
    /^(?:\[?\d{4}[-/.]\d{2}[-/.]\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?|\[?\d{2}:\d{2}:\d{2}(?:\.\d+)?\]?)\s*/i;
const LOG_LEVEL_REGEX =
    /^(?:\[?(?:INFO|WARN|WARNING|ERROR|ERR|DEBUG|TRACE|FATAL|INFO|SUCCESS)\]?)\s*/i;
const REQUEST_ID_REGEX =
    /^(?:\[?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]?)\s*/i;

/**
 * Normalizes a single log line by stripping metadata at the beginning
 * and attempting to unescape JSON strings if they are double-encoded.
 */
export function normalizeLine(line: string, index: number): NormalizedLine {
    let normalizedText = line;
    let timestamp: string | undefined;
    let level: string | undefined;
    let requestId: string | undefined;
    let prefix = '';

    // 1. Strip timestamp
    const tsMatch = normalizedText.match(TIMESTAMP_REGEX);
    if (tsMatch) {
        timestamp = tsMatch[0].trim();
        prefix += tsMatch[0];
        normalizedText = normalizedText.slice(tsMatch[0].length);
    }

    // 2. Strip Request ID (often in AWS CloudWatch)
    const reqMatch = normalizedText.match(REQUEST_ID_REGEX);
    if (reqMatch) {
        requestId = reqMatch[0].trim();
        prefix += reqMatch[0];
        normalizedText = normalizedText.slice(reqMatch[0].length);
    }

    // 3. Strip Log Level
    const lvlMatch = normalizedText.match(LOG_LEVEL_REGEX);
    if (lvlMatch) {
        level = lvlMatch[0].trim().replace(/[\[\]]/g, ''); // clean brackets
        prefix += lvlMatch[0];
        normalizedText = normalizedText.slice(lvlMatch[0].length);
    }

    // Double check if there is an extra level after timestamp/request ID
    if (!level) {
        const lvlMatch2 = normalizedText.match(LOG_LEVEL_REGEX);
        if (lvlMatch2) {
            level = lvlMatch2[0].trim().replace(/[\[\]]/g, '');
            prefix += lvlMatch2[0];
            normalizedText = normalizedText.slice(lvlMatch2[0].length);
        }
    }

    return {
        originalIndex: index,
        originalText: line,
        normalizedText,
        metadata: {
            timestamp,
            level,
            requestId,
            prefix,
        },
    };
}

/**
 * Normalizes all lines in a raw log input.
 */
export function normalizeLogs(rawInput: string): NormalizedLine[] {
    if (!rawInput) return [];

    // Handle carriage returns and split by line
    const lines = rawInput.split(/\r?\n/);
    return lines.map((line, index) => normalizeLine(line, index));
}

/**
 * Unescapes a string containing escaped JSON (e.g. \"key\": \"value\")
 * so it can be parsed normally.
 */
export function unescapeJsonString(str: string): string {
    // If it's wrapped in quotes and has escaped quotes inside, try to unescape
    let temp = str.trim();

    // Remove wrapping quotes if they exist and contain escaped quotes
    if (temp.startsWith('"') && temp.endsWith('"') && temp.includes('\\"')) {
        temp = temp.slice(1, -1);
    }

    return temp
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\b/g, '\b')
        .replace(/\\f/g, '\f');
}
