# Repository Guidelines

## Project Structure & Module Organization
- `packages/core/` TypeScript domain logic and schema utilities; source in `src/`, build outputs in `dist/`.
- `packages/webview/` React Flow UI served by Vite; builds land in `dist-web/` for the extension to load.
- `packages/extension/` VS Code host bundled via `esbuild.config.mjs`; depends on core validators and webview assets.
- `flows/` sample `.flow.json`/`.diagram.json` pairs for local QA; mirror new fixtures here.
- `schemas/` canonical `workflow-definition.schema.json`; update alongside any validator changes in core.
- `sys-tasks/` production tasks named `task@version.json`; keep published versions immutable.

## Build, Test, and Development Commands
- `npm install` installs workspace dependencies under one lockfile.
- `npm run build` compiles all packages (tsc, Vite, esbuild).
- `npm run watch` starts all package watchers for iterative work.
- `npm run -w packages/webview dev` serves the canvas at `http://localhost:5173`.
- `npm run lint` runs ESLint; resolve findings before merging.
- `npm run package` produces a VSIX via `vsce` for manual validation.

## Coding Style & Naming Conventions
- TypeScript uses ES modules, 2-space indenting, trailing semicolons, and prefers named exports from `src/`.
- Apply camelCase for variables/functions, PascalCase for React components and types, SCREAMING_SNAKE_CASE only for constants.
- Run Prettier (`npx prettier --check '**/*.{ts,tsx,json}'`) and ESLint; respect `tsconfig.base.json` path aliases.
- Keep JSON payloads minimal and stable; avoid embedding computed data in `.flow.json` sources.

## Testing Guidelines
- No automated suite yet: run `npm run build` for type guarantees and `npm run lint` for structural feedback.
- When adding tests, place them under `packages/<pkg>/src/__tests__/` and wire an `npm test` script at the root.
- Validate schema edits by loading sample flows in VS Code and confirming AJV passes without warnings.
- Capture new edge cases as fixtures in `flows/` so reviewers can replay them quickly.

## Commit & Pull Request Guidelines
- History uses short, imperative subjects (e.g., `Initial commit`); keep them under 72 chars and expand detail in the body.
- Group commits per package when practical and mention touched workspaces in bullet lists.
- PRs must state the problem, solution, and test evidence (`npm run build`, manual validation, screenshots/GIFs for UI changes).
- Tag maintainers from affected areas (`core`, `webview`, `extension`) and flag schema or task updates needing coordination.
