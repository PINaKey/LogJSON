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
        kvPairs?: Record<string, string>;
        isContinuation?: boolean;
        logFormat?: 'json' | 'kv' | 'text';
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

    const kvPairs = extractKeyValuePairs(normalizedText);
    
    let logFormat: 'json' | 'kv' | 'text' = 'text';
    const trimmed = normalizedText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        logFormat = 'json';
    } else if (kvPairs && Object.keys(kvPairs).length > 0) {
        logFormat = 'kv';
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
            kvPairs,
            logFormat,
        },
    };
}

/**
 * Extracts key=value and key="value" pairs from a string.
 */
export function extractKeyValuePairs(line: string): Record<string, string> | undefined {
    const kvPairs: Record<string, string> = {};
    const kvRegex = /([a-zA-Z0-9_.-]+)=("([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|([^ ]+))/g;
    let match;
    let found = false;
    while ((match = kvRegex.exec(line)) !== null) {
        found = true;
        const key = match[1];
        let value = match[3] !== undefined ? match[3] : (match[4] !== undefined ? match[4] : match[5]);
        
        if (match[3] !== undefined) {
            value = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        } else if (match[4] !== undefined) {
            value = value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        }
        
        kvPairs[key] = value;
    }
    return found ? kvPairs : undefined;
}

/**
 * Joins continuation lines (lines without their own timestamp/prefix) to the previous line.
 */
export function joinContinuationLines(lines: NormalizedLine[]): NormalizedLine[] {
    const joined: NormalizedLine[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0) {
            joined.push(line);
            continue;
        }

        const prev = joined[joined.length - 1];
        
        if (!line.metadata?.prefix && line.normalizedText.trim() !== '') {
            prev.normalizedText += '\n' + line.normalizedText;
            prev.originalText += '\n' + line.originalText;
            line.metadata = { ...line.metadata, isContinuation: true };
        } else {
            joined.push(line);
        }
    }
    return joined;
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
