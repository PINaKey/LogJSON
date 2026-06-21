export const SAMPLE_LOGS = `2026-06-21T11:03:32.456Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d INFO Initializing session for user "pinaki"
2026-06-21T11:03:32.500Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d DEBUG Request payload intercepted:
POST https://api.logjson.dev/v1/auth/login
Content-Type: application/json
{
  "email": "user@logjson.com",
  "client": "web-app",
  "device": "mac-client"
}

2026-06-21T11:03:32.580Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d INFO auth-service: processing credentials
2026-06-21T11:03:32.610Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d WARN Rate limit headers calculated. Remaining: 98/100
2026-06-21T11:03:32.645Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d INFO Response payload returned: status=200 took 145ms
{
  "authenticated": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzAxIiwicm9sZSI6ImFkbWluIn0",
  "user": {
    "id": "user_01",
    "name": "Pinaki",
    "permissions": ["read", "write", "parse"]
  }
}

2026-06-21T11:03:33.100Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d DEBUG stdout contains double-escaped JSON line:
{"level":"info","message":"Event received: \\"{\\\\\\"event\\\\\\":\\\\\\"click\\\\\\",\\\\\\"target\\\\\\":\\\\\\"parse-button\\\\\\",\\\\\\"meta\\\\\\":{\\\\\\"timestamp\\\\\\":1718956800}}\\""}

2026-06-21T11:03:33.200Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d INFO GET /v1/user/profile?id=user_01 - returned 200
{"status":"success","data":{"profile":{"avatar":"avatar.png","theme":"dark"}}}

2026-06-21T11:03:34.000Z 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d ERROR Database fetch failed for /v1/data/sync:
{"error_code":"DB_CONN_TIMEOUT","message":"Connection pool exhausted","details":{"max_connections":50,"active_connections":50}}
`;
