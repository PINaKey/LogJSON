import { type ExtractedJson } from './types';
import { unescapeJsonString } from './log-normalizer';

/**
 * Generates a unique ID
 */
function generateId(): string {
    return `json_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if candidate string contains valid JSON and return parsed object.
 */
/**
 * Strips outer double quotes wrapping a valid nested JSON object/array inside a string
 */
function stripWrappingQuotesFromNestedJson(str: string): string {
    let result = str;
    const startIdx = result.indexOf('"{');
    const endIdx = result.lastIndexOf('}"');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonCandidate = result.substring(startIdx + 1, endIdx + 1);
        try {
            JSON.parse(jsonCandidate);
            result = result.substring(0, startIdx) + jsonCandidate + result.substring(endIdx + 2);
        } catch {
            // ignore
        }
    }
    
    const startArrIdx = result.indexOf('"[');
    const endArrIdx = result.lastIndexOf(']"');
    
    if (startArrIdx !== -1 && endArrIdx !== -1 && endArrIdx > startArrIdx) {
        const jsonCandidate = result.substring(startArrIdx + 1, endArrIdx + 1);
        try {
            JSON.parse(jsonCandidate);
            result = result.substring(0, startArrIdx) + jsonCandidate + result.substring(endArrIdx + 2);
        } catch {
            // ignore
        }
    }
    
    return result;
}

/**
 * Recursively cleans and unescapes parsed JSON values (objects, arrays, and strings).
 * If a string field itself contains stringified JSON, it will be recursively parsed.
 * Otherwise, double-escaped escape sequences are unescaped.
 */
function cleanParsedValue(val: any): any {
    if (val === null || val === undefined) {
        return val;
    }
    if (Array.isArray(val)) {
        return val.map(cleanParsedValue);
    }
    if (typeof val === 'object') {
        const cleaned: any = {};
        for (const key of Object.keys(val)) {
            cleaned[key] = cleanParsedValue(val[key]);
        }
        return cleaned;
    }
    if (typeof val === 'string') {
        let str = val.trim();
        
        // 1. Remove wrapping quotes if the string is fully wrapped and has escaped content
        if (str.startsWith('"') && str.endsWith('"') && str.includes('\\"')) {
            str = str.slice(1, -1);
        }

        // 2. If the string is a valid JSON array or object, parse it recursively
        if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
            try {
                const parsed = JSON.parse(str);
                if (parsed !== null && typeof parsed === 'object') {
                    return cleanParsedValue(parsed);
                }
            } catch {
                try {
                    const unescaped = unescapeJsonString(str);
                    const parsed = JSON.parse(unescaped);
                    if (parsed !== null && typeof parsed === 'object') {
                        return cleanParsedValue(parsed);
                    }
                } catch {
                    // ignore
                }
            }
        }
        
        // 3. If it contains escaped quotes, unescape them and strip wrapping quotes from inner JSON
        if (val.includes('\\"')) {
            const unescaped = unescapeJsonString(val);
            return stripWrappingQuotesFromNestedJson(unescaped);
        }
    }
    return val;
}

/**
 * Check if candidate string contains valid JSON and return parsed object.
 */
function tryParseJson(
    raw: string,
): { parsed: unknown; isEscaped: boolean } | null {
    // 1. Try parsing directly
    try {
        const parsed = JSON.parse(raw);
        // Ensure it's an object or array, not a number/string/boolean/null
        if (parsed !== null && typeof parsed === 'object') {
            return { parsed: cleanParsedValue(parsed), isEscaped: false };
        }
    } catch {
        // ignore
    }

    // 2. Try parsing after unescaping (handles double-escaped JSON)
    try {
        const unescaped = unescapeJsonString(raw);
        const parsed = JSON.parse(unescaped);
        if (parsed !== null && typeof parsed === 'object') {
            return { parsed: cleanParsedValue(parsed), isEscaped: true };
        }
    } catch {
        // ignore
    }

    // 3. Try parsing by replacing single quotes with double quotes (lax JSON)
    if (raw.includes("'")) {
        try {
            // Very basic conversion: replace single quotes with double quotes.
            const cleaned = raw
                .replace(/([{\s,])(\w+)(?=\s*:)/g, '$1"$2"') // quote unquoted keys
                .replace(/'/g, '"'); // replace single quotes with double quotes

            const parsed = JSON.parse(cleaned);
            if (parsed !== null && typeof parsed === 'object') {
                return { parsed: cleanParsedValue(parsed), isEscaped: false };
            }
        } catch {
            // ignore
        }
    }

    return null;
}

/**
 * Scans text and extracts JSON objects and arrays using bracket matching.
 */
export function extractJsonFromText(text: string): ExtractedJson[] {
    const results: ExtractedJson[] = [];
    const len = text.length;

    const lineOffsets: number[] = [0]; // offset of start of each line

    for (let i = 0; i < len; i++) {
        if (text[i] === '\n') {
            lineOffsets.push(i + 1);
        }
    }

    // Helper to get line and column for a index
    function getLineCol(index: number): { line: number; col: number } {
        let low = 0;
        let high = lineOffsets.length - 1;
        let lineIdx = 0;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (lineOffsets[mid] <= index) {
                lineIdx = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return {
            line: lineIdx + 1,
            col: index - lineOffsets[lineIdx] + 1,
        };
    }

    // Helper to get the context line for a starting index
    function getContextLine(index: number): string {
        const { line: lineNum } = getLineCol(index);
        const startOffset = lineOffsets[lineNum - 1] || 0;
        const nextLineOffset = lineOffsets[lineNum];
        const endOffset =
            nextLineOffset !== undefined ? nextLineOffset - 1 : text.length;

        // Extract the line, truncate if extremely long
        let lineStr = text.substring(startOffset, endOffset).trim();
        if (lineStr.length > 150) {
            lineStr = lineStr.substring(0, 150) + '...';
        }
        return lineStr;
    }

    // Scan character by character
    for (let i = 0; i < len; i++) {
        const char = text[i];

        if (char === '{' || char === '[') {
            const startPos = i;
            const startChar = char;
            const closeChar = startChar === '{' ? '}' : ']';

            let depth = 0;
            let inString = false;
            let stringChar = '';
            let foundMatch = false;
            let endPos = -1;
            let backslashCount = 0;

            for (let j = startPos; j < len; j++) {
                const c = text[j];

                if (c === '\\') {
                    backslashCount++;
                    continue;
                }

                const isQuote = c === '"' || c === "'";
                const isEscaped = backslashCount % 2 !== 0;

                if (isQuote) {
                    if (!isEscaped) {
                        if (inString) {
                            if (c === stringChar) {
                                inString = false;
                            }
                        } else {
                            inString = true;
                            stringChar = c;
                        }
                    }
                } else if (!inString) {
                    if (c === startChar) {
                        depth++;
                    } else if (c === closeChar) {
                        depth--;
                        if (depth === 0) {
                            endPos = j;
                            foundMatch = true;
                            break;
                        }
                    }
                }

                backslashCount = 0; // reset for non-backslash
            }

            if (foundMatch && endPos !== -1) {
                const rawContent = text.substring(startPos, endPos + 1);
                const parsedResult = tryParseJson(rawContent);

                if (parsedResult) {
                    const { line: startLine, col: startCol } =
                        getLineCol(startPos);
                    const { line: endLine, col: endCol } = getLineCol(endPos);
                    const context = getContextLine(startPos);

                    const extracted: ExtractedJson = {
                        id: generateId(),
                        raw: rawContent,
                        parsed: parsedResult.parsed,
                        location: {
                            startLine,
                            endLine,
                            startCol,
                            endCol,
                        },
                        isNested: false,
                        isEscaped: parsedResult.isEscaped,
                        isIncomplete: false,
                        context,
                    };

                    results.push(extracted);
                }
            }
        }
    }

    // Post-process to flag nested JSONs
    // A JSON block is nested if its start/end coordinates are inside another JSON block
    for (let i = 0; i < results.length; i++) {
        const candidate = results[i];
        for (let j = 0; j < results.length; j++) {
            if (i === j) continue;
            const other = results[j];

            const candidateStart =
                candidate.location.startLine * 1000000 +
                candidate.location.startCol;
            const otherStart =
                other.location.startLine * 1000000 + other.location.startCol;

            const candidateEnd =
                candidate.location.endLine * 1000000 +
                candidate.location.endCol;
            const otherEnd =
                other.location.endLine * 1000000 + other.location.endCol;

            if (candidateStart > otherStart && candidateEnd < otherEnd) {
                candidate.isNested = true;
                break;
            }
        }
    }

    // Sort by start line and start col
    return results.sort((a, b) => {
        if (a.location.startLine !== b.location.startLine) {
            return a.location.startLine - b.location.startLine;
        }
        return a.location.startCol - b.location.startCol;
    });
}
