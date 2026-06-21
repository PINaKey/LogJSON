/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { normalizeLogs, unescapeJsonString } from './log-normalizer';
import { extractJsonFromText } from './json-extractor';
import { extractApiDetails } from './api-extractor';

describe('Log Normalizer', () => {
    it('should strip AWS CloudWatch metadata prefixes', () => {
        const log =
            '2026-06-21T11:03:32.123Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d INFO Hello World';
        const normalized = normalizeLogs(log);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].normalizedText.trim()).toBe('Hello World');
        expect(normalized[0].metadata?.level).toBe('INFO');
        expect(normalized[0].metadata?.requestId).toBe(
            '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        );
    });

    it('should unescape escaped JSON strings', () => {
        const escaped = '\\"key\\": \\"value\\\\nnewValue\\"';
        const unescaped = unescapeJsonString(escaped);
        expect(unescaped).toBe('"key": "value\nnewValue"');
    });
});

describe('JSON Extractor', () => {
    it('should extract simple JSON objects', () => {
        const text =
            'Some log line with JSON: {"name": "Alice", "age": 30} and some trailing text';
        const jsons = extractJsonFromText(text);

        expect(jsons).toHaveLength(1);
        expect(jsons[0].parsed).toEqual({ name: 'Alice', age: 30 });
        expect(jsons[0].isNested).toBe(false);
        expect(jsons[0].isEscaped).toBe(false);
        expect(jsons[0].location.startCol).toBe(26);
    });

    it('should extract nested JSON objects and flag them as nested', () => {
        const text =
            'Outer JSON: {"user": {"details": {"name": "Bob"}}, "role": "admin"}';
        const jsons = extractJsonFromText(text);

        // Should find outer {"user": ...} and inner {"details": ...} and {"name": "Bob"}
        expect(jsons.length).toBeGreaterThanOrEqual(2);

        const outer = jsons.find((j) => !j.isNested);
        const inner = jsons.find(
            (j) => j.isNested && j.raw === '{"name": "Bob"}',
        );

        expect(outer).toBeDefined();
        expect(inner).toBeDefined();
        expect((outer?.parsed as any).role).toBe('admin');
        expect((inner?.parsed as any).name).toBe('Bob');
    });

    it('should extract double-escaped JSON strings', () => {
        const text =
            'Payload: "{\\"userId\\": 123, \\"action\\": \\"login\\"}"';
        const jsons = extractJsonFromText(text);

        expect(jsons).toHaveLength(1);
        expect(jsons[0].parsed).toEqual({ userId: 123, action: 'login' });
        expect(jsons[0].isEscaped).toBe(true);
    });

    it('should tolerate single quoted fields', () => {
        const text = "JS Style: { name: 'Charlie', active: true }";
        const jsons = extractJsonFromText(text);

        expect(jsons).toHaveLength(1);
        expect(jsons[0].parsed).toEqual({ name: 'Charlie', active: true });
    });

    it('should recursively parse and unescape JSON fields inside JSON objects', () => {
        // Test case 1: String field containing text prefix + escaped JSON string
        const text1 = '{"level": "info", "message": "Event received: \\"{\\\\\\\"event\\\\\\\":\\\\\\\"click\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"parse-button\\\\\\\",\\\\\\\"meta\\\\\\\":{\\\\\\\"timestamp\\\\\\\":1718956800}}\\""}';
        const jsons1 = extractJsonFromText(text1);

        expect(jsons1).toHaveLength(1);
        const parsed1: any = jsons1[0].parsed;
        expect(parsed1.level).toBe('info');
        expect(parsed1.message).toBe('Event received: {"event":"click","target":"parse-button","meta":{"timestamp":1718956800}}');

        // Test case 2: String field containing pure escaped JSON string (should parse recursively into object)
        const text2 = '{"level": "info", "payload": "\\"{\\\\\\\"event\\\\\\\":\\\\\\\"click\\\\\\\",\\\\\\\"target\\\\\\\":\\\\\\\"parse-button\\\\\\\"}\\""}';
        const jsons2 = extractJsonFromText(text2);

        expect(jsons2).toHaveLength(1);
        const parsed2: any = jsons2[0].parsed;
        expect(parsed2.level).toBe('info');
        expect(parsed2.payload).toEqual({
            event: 'click',
            target: 'parse-button'
        });
    });
});

describe('API Extractor', () => {
    it('should extract API details from log line', () => {
        const text =
            '2026-06-21 11:00:00 INFO POST /api/v1/users status=201 took 125ms';
        const apis = extractApiDetails(text, []);

        expect(apis).toHaveLength(1);
        expect(apis[0].method).toBe('POST');
        expect(apis[0].url).toBe('/api/v1/users');
        expect(apis[0].statusCode).toBe(201);
        expect(apis[0].latency).toBe('125ms');
    });

    it('should associate nearby JSONs with API request/response', () => {
        const logs = `
      2026-06-21 INFO POST /api/v1/login
      Request Payload:
      {"username": "admin", "password": "password"}
      Response Result:
      {"success": true, "token": "jwt_token_xyz"}
    `;

        const jsons = extractJsonFromText(logs);
        const apis = extractApiDetails(logs, jsons);

        expect(apis).toHaveLength(1);
        expect(apis[0].method).toBe('POST');
        expect(apis[0].url).toBe('/api/v1/login');
        expect(apis[0].requestBody).toEqual({
            username: 'admin',
            password: 'password',
        });
        expect(apis[0].responseBody).toEqual({
            success: true,
            token: 'jwt_token_xyz',
        });
    });
});
