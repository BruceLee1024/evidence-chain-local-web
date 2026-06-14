# Repository Guidelines

## Project Structure & Module Organization

This is a local evidence-chain web app with a Vite/React client and Express API.

- `src/`: React UI, API wrapper, and global CSS (`App.jsx`, `api.js`, `styles.css`).
- `server/`: Express routes, SQLite schema/repository code, file storage, and domain logic.
- `server/lib/`: testable business logic for matching, settlement import, and export tree generation.
- `test/`: Vitest unit tests named `*.test.js`.
- `doc/`: product and module requirement notes in Chinese.
- `public/`: static browser assets.
- `data/`: local SQLite database and uploaded files. Treat as runtime state, not source.
- `dist/`: Vite build output. Regenerate instead of editing directly.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: run API and Vite client together. The client uses `127.0.0.1:5173` and proxies `/api` to `127.0.0.1:8787`.
- `npm run dev:server`: start only the Express API.
- `npm run dev:client`: start only the Vite frontend.
- `npm test`: run Vitest tests once.
- `npm run build`: produce the production client bundle in `dist/`.
- `npm run preview`: preview the built frontend locally.

## Coding Style & Naming Conventions

Use ES modules throughout. Match the existing style: 2-space indentation, semicolons, single quotes, named exports for reusable server helpers, and PascalCase for React components. Keep domain functions small and testable under `server/lib/` when they do not need Express request context. Prefer clear evidence-domain names such as `settlementSession`, `evidenceId`, and `normalizedLocation`.

## Testing Guidelines

Vitest is configured for Node tests with `test/**/*.test.js`. Add tests beside the existing suites when changing matching, import parsing, export layout, or repository-independent logic. Prefer focused fixtures with Chinese construction terms where behavior depends on project language. Run `npm test` before handoff; run `npm run build` when UI or bundling code changes.

## Commit & Pull Request Guidelines

This folder has no `.git` history, so no project-specific commit convention can be inferred. Until history exists, use concise Conventional Commits, for example `feat: add monthly measurement matching` or `fix: preserve uploaded file roles`. Pull requests should include a behavior summary, affected paths, test/build results, linked issue or requirement note, and screenshots for visible UI changes.

## Security & Configuration Tips

Runtime data lives under `data/` by default and can be moved with `EVIDENCE_DATA_DIR`. The API port defaults to `8787` and can be changed with `PORT`. Do not commit `.env`, uploaded files, SQLite databases, logs, `node_modules/`, `dist/`, or other generated artifacts.
