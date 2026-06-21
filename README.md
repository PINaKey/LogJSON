# LogJSON — Log Parser & JSON Extractor

LogJSON is a stateless, client-side web application designed to help developers extract, unescape, and format JSON structures embedded in log outputs (e.g., from AWS CloudWatch, GCP Cloud Logging, Elasticsearch, Docker, or stdout). It also automatically scans log lines to reconstruct HTTP API details—correlating methods, URLs, status codes, latencies, and payload bodies.

---

## ✨ Features

- **Robust Bracket-Matching Parser**: character-by-character scanner with double-backslash tracking that extracts nested JSON, double-escaped strings, and JavaScript-like single-quoted blocks.
- **Deep Keyword-Based API Correlation**: Upgraded parser engine that walks JSON objects recursively to extract deeply nested method, url, status, request/response body, latency, query parameters, and error details (code, message, stack traces).
- **API Confidence Scoring System**: Automatically scores and badges matched endpoints (**High / Medium / Low**) based on matched properties. Offers a toolbar toggle filter in the UI to hide noisy, low-confidence entries, and an interactive tooltip explaining the scoring.
- **PII & User Details Extractor (New Tab)**: Scans logs and JSON structures for sensitive attributes including Bearer Tokens, API Keys, Emails, Phone Numbers (refined to US, Indian, and standalone 10-digit formats), User IDs, Usernames, Session IDs, and Client IP addresses. Surfaced behind a dedicated PII warning banner with high/medium confidence scores.
- **Always-On JWT.io Inspector**: Generates direct links for all bearer tokens (with stripped quotes and cleaned spacing) to inspect them instantly on the JWT.io debugger.
- **JWT Claims Tree**: Automatically base64-decodes JWT payloads (supporting both signed and unsigned structures) and renders them in an interactive collapsible tree viewer.
- **Background Web Worker Thread**: Offloads logs exceeding 10,000 lines to a worker thread to keep the main thread fully responsive.
- **Premium Dark Mode & Glassmorphic UI**: High-contrast, custom scrollbars, glowing active states, and auto-collapsed JSON tree structures (beyond depth 3).
- **Smooth Animations**: spring physics transitions, staggered card listings, and responsive layouts powered by Framer Motion.
- **Locate Log Line Jumper**: Click any reference link on results cards to immediately scroll to, focus, and highlight the source line in the log input.
- **Full Keyboard Navigation**: Command shortcuts for pasting, clearing, downloading, switching tabs, and theme toggling.

---

## 🛠️ Tech Stack

- **Build Tool**: Vite
- **Language**: TypeScript
- **Framework**: React 19 (Component-based architecture)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Syntax Highlighting**: Custom recursive nodes & Prism.js
- **Testing**: Vitest

---

## 📂 Project Structure

```
LogJSON/
├── src/
│   ├── main.tsx             # React Entrypoint
│   ├── App.tsx              # Main Shell & State
│   ├── styles/
│   │   ├── index.css        # Reset, fonts, and scrollbars
│   │   ├── themes.css       # Light/Dark tokens
│   │   └── components.css   # Layout, cards, tree, modals, tooltips
│   ├── parsers/             # Core Engine (Pure TS, No React Imports)
│   │   ├── types.ts         # Parsed interfaces
│   │   ├── log-normalizer.ts# Strip prefixes & unescape
│   │   ├── json-extractor.ts# Bracket-matching scanner
│   │   ├── api-extractor.ts # HTTP endpoints & payloads mapper
│   │   └── user-extractor.ts# PII, credentials, & JWT decoder (New)
│   ├── components/          # React Components
│   │   ├── LogoBanner.tsx   # Header & actions bar
│   │   ├── InputPanel.tsx   # Input, files drag/drop, stats
│   │   ├── OutputPanel.tsx  # Tabs rendering & text filter
│   │   ├── JsonTree.tsx     # Custom collapsible tree viewer
│   │   ├── JsonCard.tsx     # Extracted JSON card
│   │   ├── ApiCard.tsx      # Correlated HTTP request card
│   │   ├── UserDetailCard.tsx# Surfaced PII / credential card (New)
│   │   ├── StatusBar.tsx    # Parsed counts & timers
│   │   ├── EmptyState.tsx   # Quick actions onboarding view
│   │   └── Toast.tsx        # Toast notifications
│   ├── hooks/
│   │   ├── useTheme.ts      # Theme manager (persisted)
│   │   ├── useParser.ts     # Parsing orchestrator & Worker hook
│   │   └── useKeyboardShortcuts.ts # Global shortkeys
│   ├── workers/
│   │   └── parser.worker.ts # Worker thread logics
│   └── utils/
│       ├── clipboard.ts     # Clipboard copier
│       ├── download.ts      # Files downloader
│       └── sample-logs.ts   # Mixed sample demo log data
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + V` | Paste clipboard contents and immediately parse (on empty state) |
| `Cmd/Ctrl + Shift + C` | Copy all extracted JSON blocks to clipboard |
| `Cmd/Ctrl + D` | Download all parsed results as a `.json` file |
| `Cmd/Ctrl + L` | Clear logs input and reset results state |
| `Cmd/Ctrl + K` | Toggle Light/Dark Mode |
| `1` / `2` / `3` / `4` | Switch output tabs: JSON / APIs / Users / Normalized |

---

## 🚀 Local Setup & Installation

### Prerequisites

Ensure you have **Node.js** (v18 or higher) and **npm** installed on your system.

### 1. Clone & Navigate
Navigate into your workspace directory:
```bash
cd LogJSON
```

### 2. Install Dependencies
Download and install all project libraries:
```bash
npm install
```

### 3. Start Development Server
Run Vite's local dev server:
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### 4. Run Tests
Verify parsing logic using Vitest:
```bash
npx vitest run
```

### 5. Build for Production
Bundle and optimize assets for hosting:
```bash
npm run build
```
Preview the built folder locally:
```bash
npm run preview
```
All production files will be compiled inside the `dist/` directory.
