/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import {
    normalizeLogs,
    unescapeJsonString,
    extractKeyValuePairs,
    joinContinuationLines,
} from './log-normalizer';
import { extractJsonFromText } from './json-extractor';
import { extractApiDetails } from './api-extractor';
import { extractUserDetails } from './user-extractor';

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

    it('should extract key-value pairs', () => {
        const line = 'INFO method=POST url="/api/v1/users" status=200';
        const kv = extractKeyValuePairs(line);
        expect(kv).toBeDefined();
        expect(kv?.method).toBe('POST');
        expect(kv?.url).toBe('/api/v1/users');
        expect(kv?.status).toBe('200');
    });

    it('should join continuation lines', () => {
        const logs = `2026-06-21 INFO User request:
{
  "name": "Alice"
}`;
        const normalized = normalizeLogs(logs);
        const joined = joinContinuationLines(normalized);
        expect(joined).toHaveLength(1);
        expect(joined[0].normalizedText).toContain('"name": "Alice"');
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

    it('should extract NDJSON (multiple concatenated JSON objects)', () => {
        const text = '{"a": 1}{"b": 2} {"c": 3}';
        const jsons = extractJsonFromText(text);
        expect(jsons).toHaveLength(3);
        expect(jsons[0].parsed).toEqual({ a: 1 });
        expect(jsons[1].parsed).toEqual({ b: 2 });
        expect(jsons[2].parsed).toEqual({ c: 3 });
    });

    it('should recover truncated JSON', () => {
        const text = 'Truncated: {"user": {"name": "Alice", "age": 30';
        const jsons = extractJsonFromText(text);
        expect(jsons).toHaveLength(1);
        expect(jsons[0].isIncomplete).toBe(true);
        expect(jsons[0].parsed).toEqual({ user: { name: 'Alice', age: 30 } });
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
        expect(apis[0].confidence).toBeGreaterThan(0.6);
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

    it('should extract deep-nested API details using keyword scanning', () => {
        const jsonText = JSON.stringify({
            data: {
                event: {
                    req: {
                        method: 'PUT',
                        url: '/api/v2/update',
                        headers: { 'x-auth': '123' },
                    },
                    res: {
                        statusCode: 200,
                        latency: 45,
                        error: { message: 'Some warning', code: 'W_01' },
                    },
                },
            },
        });
        const jsons = extractJsonFromText(jsonText);
        const apis = extractApiDetails(jsonText, jsons);

        expect(apis).toHaveLength(1);
        const api = apis[0];
        expect(api.method).toBe('PUT');
        expect(api.url).toBe('/api/v2/update');
        expect(api.statusCode).toBe(200);
        expect(api.latency).toBe('45ms');
        expect(api.headers).toEqual({ 'x-auth': '123' });
        expect(api.error?.message).toBe('Some warning');
        expect(api.error?.code).toBe('W_01');
    });

    it('should extract multiple APIs from a single JSON', () => {
        const jsonText = JSON.stringify({
            calls: [
                { method: 'GET', url: '/api/1', status: 200 },
                { method: 'POST', url: '/api/2', status: 201 },
            ],
        });
        const jsons = extractJsonFromText(jsonText);
        const apis = extractApiDetails(jsonText, jsons);

        expect(apis).toHaveLength(2);
        expect(apis.some((a) => a.url === '/api/1')).toBe(true);
        expect(apis.some((a) => a.url === '/api/2')).toBe(true);
    });

    it('should correctly merge regex and structured APIs', () => {
        // Regex matches the log line, JSON is the structured log
        const logs = `INFO GET /api/v1/test status=200
{"method": "GET", "url": "/api/v1/test", "status": 200, "duration": 50}`;

        const jsons = extractJsonFromText(logs);
        const apis = extractApiDetails(logs, jsons);

        // They should be merged into 1
        expect(apis).toHaveLength(1);
        expect(apis[0].url).toBe('/api/v1/test');
        expect(apis[0].latency).toBe('50ms'); // taken from structured
    });
});

describe('User Details Extractor', () => {
    it('should extract bearer tokens and always generate jwt.io link', () => {
        const logs = 'INFO Auth token: Bearer abc123xyz-not-a-jwt';
        const jsons = extractJsonFromText(logs);
        const details = extractUserDetails(logs, jsons);

        expect(details).toHaveLength(1);
        expect(details[0].type).toBe('bearer_token');
        expect(details[0].value).toBe('abc123xyz-not-a-jwt');
        expect(details[0].jwtInspectUrl).toBe('https://jwt.io/#debugger-io?token=abc123xyz-not-a-jwt');
        expect(details[0].jwtPayload).toBeUndefined();
    });

    it('should decode JWT payload and generate link for valid JWT', () => {
        // A simple valid JWT structure (header.payload.signature)
        // Header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
        // Payload: {"sub":"user123","email":"test@example.com"} -> eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0
        // Signature: dummy -> signature
        const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.signature';
        const logs = `DEBUG Received request with Bearer ${jwt}`;
        const jsons = extractJsonFromText(logs);
        const details = extractUserDetails(logs, jsons);

        expect(details).toHaveLength(1);
        const bearer = details[0];
        expect(bearer).toBeDefined();
        expect(bearer.type).toBe('bearer_token');
        expect(bearer.value).toBe(jwt);
        expect(bearer.jwtInspectUrl).toBe(`https://jwt.io/#debugger-io?token=${encodeURIComponent(jwt)}`);
        expect(bearer.jwtPayload).toEqual({
            sub: 'user123',
            email: 'test@example.com'
        });
    });

    it('should extract refined phone numbers with high confidence and ignore low-confidence formats', () => {
        const logs = `
            Call from (123) 456 7890 to +91 1234567890
            Or dial 1234567890 directly.
            Do not extract random IDs or dates like 2026-06-21, 123-45, or 1234567.
        `;
        const jsons = extractJsonFromText(logs);
        const details = extractUserDetails(logs, jsons);

        const phones = details.filter(d => d.type === 'phone');
        expect(phones).toHaveLength(3);

        expect(phones.map(p => p.value)).toContain('(123) 456 7890');
        expect(phones.map(p => p.value)).toContain('+91 1234567890');
        expect(phones.map(p => p.value)).toContain('1234567890');
        expect(phones.every(p => p.confidence === 'high')).toBe(true);
    });
});
