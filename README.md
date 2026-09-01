# EchoForge

EchoForge is an interactive narrative game built with React, TypeScript, and a small Go API server. It turns a player's situation into a bounded story world, lets multiple characters respond from distinct goals and limited knowledge, and keeps authoritative state changes in deterministic game logic.

## Highlights

- Adult reflection, children's picture-book, and classic-story routes
- Deterministic local fallbacks when AI providers are unavailable
- Optional text, image, speech, and video provider integrations
- Browser-local session recovery without a user database
- MediaPipe-powered camera interaction and local WebM export

## Run locally

Requirements: Node.js 24+, pnpm 9+, and Go 1.25+.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm dev
```

The UI runs through Vite and proxies API requests to the Go server on port 3001. The development proxy supplies a local test identity through `X-User-Info`.

For a production build:

```bash
pnpm build
APP_PORT=3000 go run ./backend
```

## Optional AI configuration

The application runs without provider credentials. To enable AI features, copy `.env.example` to `.env`, replace the placeholders, and export the variables before starting the Go server. Credentials are read only by the server, except for an optional MiMo key that a user explicitly enters for the current browser tab.

Never commit `.env`, `*.properties`, API keys, access tokens, or provider response dumps. The repository ignore rules cover the known local credential and workspace files.

In production, the API expects a trusted reverse proxy to authenticate requests and replace the `X-User-Info` header with a JSON object containing at least `userId`. Do not expose the server while allowing clients to forge this header.

## Repository scope

This public repository contains the application source and runtime assets. Local deployment metadata, provider credentials, generated build output, private planning notes, and presentation artifacts are intentionally excluded.
