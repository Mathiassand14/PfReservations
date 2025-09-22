# Repository Guidelines

## Project Structure & Modules
- `server.js`: Express entrypoint and app wiring.
- `routes/`: HTTP endpoints; thin controllers calling services.
- `services/`: Business logic; keep DB-agnostic.
- `repositories/`: Data access to PostgreSQL.
- `models/`: Data shapes and helpers.
- `middleware/`: Auth, validation, error handling.
- `migrations/` and `seeds/`: DB schema and seed data.
- `public/`: Static frontend assets served by Express.
- `tests/`: Jest tests (`unit/`, `integration/`).

## Build, Test, Run
- `npm run dev`: Start with nodemon (auto-reload).
- `npm start`: Start production server.
- `npm run migrate`: Apply DB migrations.
- `npm run seed`: Load sample data.
- `npm test`: Run all Jest tests.
- Docker: `docker-compose up -d`, then `docker-compose exec app npm run migrate && npm run seed`.

## Coding Style & Naming
- Language: Node.js (ES2019+), Express.
- Indentation: 2 spaces; use semicolons; single quotes.
- Files: kebab-case for routes/middleware, camelCase for functions/vars, PascalCase only for classes.
- Keep routes thin; put logic in `services/`; DB calls in `repositories/`.
- Prefer small, pure functions; avoid side effects in helpers.

## Testing Guidelines
- Framework: Jest (+ Supertest for HTTP).
- Locations: `tests/unit/**`, `tests/integration/**`.
- Names: `*.test.js` (unit) and `*.spec.js` (integration).
- Run coverage: `npm test -- --coverage` (aim ≥80% on touched code).
- Use Supertest against the exported app from `server.js`.

## Commit & PR Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Scope optional: `feat(routes): add calendar feed`.
- PRs: include summary, screenshots for UI changes, steps to test, and reference issues (`Closes #123`).
- Keep PRs small and focused; add migration/seed notes if applicable.

## Security & Config
- Env vars in `.env` (see `.env.example`): `DATABASE_URL`, `PORT`.
- Do not commit secrets; prefer `.env` + Docker secrets.
- Admin token protection is disabled in this environment (internal network assumption).

## Architecture Notes
- Request flow: `routes` → `middleware` → `services` → `repositories` → DB.
- Errors: throw typed errors in services; let global `errorHandler` map to HTTP.

## Spec-Driven Workflow (Strict)
- Location: Place every feature spec under `.Specs/<FeatureName>/`. Do not use `features/` or `Specs/`.
- Required files per feature: `spec.md` (PRD), `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and a `contracts/` folder. If a file is not applicable, state why at the top and keep it minimal — do not omit silently.
- Creation trigger: On any new feature input or change request, immediately create or update these files. The spec is the source of truth; code and tests must express it.
- Contracts and tests-first: Before implementation, add contracts under `contracts/` and write failing integration tests aligned to those contracts. Follow RED → GREEN → REFACTOR.
- Upstream import (.kiro): If `.kiro/` exists, run `npm run specs:sync` to import into `.Specs/_Kiro/` on every spec change. Reconcile differences:
  - Precedence: The `.Specs/<Feature>/spec.md` is authoritative if conflict exists.
  - Adoption: If `.kiro` guidance is clearly superior (simpler, safer, more consistent) and does not violate acceptance criteria, adopt it and record the change in `plan.md`.
- Naming: Use TitleCase for `<FeatureName>` (e.g., `PricingAndOrderTime`). Contracts use clear, kebab-cased filenames describing behavior.
- Ambiguities: Never guess. Insert `[NEEDS CLARIFICATION: …]` in `spec.md` and block tasks dependent on it.
- Prohibitions: Do not place specs outside `.Specs/`. Do not modify `.Specs/_Kiro/` by hand — use `specs:sync`.

## Feature Naming Convention
- Use TitleCase everywhere for feature names and folders.
- Specs location: `.Specs/<FeatureName>/` (e.g., `.Specs/PricingAndOrderTime`).
- References in docs, tasks, and scripts must use the TitleCase feature name consistently.

## Task List Triggers
- Commands: `/tasks`, `/task`, or `task` must generate or update the active task list for the current feature.
- Storage: Reflect the task list in the assistant response and persist to `.Specs/<FeatureName>/tasks.md`. If the task list requires multiple levels or domains, create `.Specs/<FeatureName>/tasks/` with an index `tasks.md` that links to domain files (e.g., `database_tasks.md`, `service_tasks.md`, `interface_tasks.md`).
- Editing rules:
  - Preserve numbering (`T001+`). If a task is changed, keep its ID and update its description; mark removed tasks as `DEPRECATED` with a pointer to the replacement.
  - Enforce test-first ordering: contracts and integration tests precede implementation; unit tests accompany or follow.
  - Parallelization: mark `[P]` only for tasks that touch different files. Sequentialize tasks that modify the same file.
  - Dependencies: include explicit dependencies and validate no two `[P]` tasks write the same file.
- Idempotency: repeated invocations merge changes without duplicating tasks.

## Task Status Markup (Required)
- Status markers must precede every task and sub-task using brackets:
  - `[ ]` pending (not started)
  - `[>]` in_progress (currently executing)
  - `[x]` completed (done)
  - `[!]` blocked (cannot proceed)
  - `[?]` needs_clarification (awaiting input)
  - `[D]` deprecated (replaced/superseded)
- Example: `- [ ] T011: Migrations — rebate groups and customer fields`.
- Exactly one task may be marked `[>]` at a time per active stream of work. Update markers as progress changes and maintain numbering stability.
 - Priority: Always update the status marker immediately when any task or sub-task changes state. Keeping statuses accurate is the top priority in task execution.

## Task Execution Persistence
- Trigger: When the user says “start” (or similar, e.g., “begin tasks”, “execute tasks”), enter continuous task execution mode.
- Behavior: Progress through tasks in order, updating status markers (`[>]`, `[x]`, etc.), and providing concise progress updates.
- Stop conditions: Only stop when (a) all tasks for the active feature are completed, (b) the user explicitly says stop/pause, or (c) an external constraint requires user input (e.g., approvals, missing clarifications marked `[?]`).
- Constraints: Respect sandboxing/approvals; pause and request input when elevated permissions, destructive actions, or ambiguities arise.
- Idempotent retries: On transient failures, retry up to 2 times with backoff; if still failing, mark `[!]` blocked and report.
- Execution order (chronological): Execute tasks strictly in ascending ID order (T001, T001-01, T001-02, …, T002, …) across all domain files. Always pick the lowest pending (`[ ]`) ID next unless an explicit dependency requires a different order. Do not skip ahead unless blocked or waiting on dependencies/clarifications.

## Task Structure & Files (Hierarchical)
- Main vs sub-tasks: Use main task IDs `T001+` for top-level items. Sub-tasks extend the main ID with a dash and two digits (e.g., `T005-01`, `T005-02`). Keep main IDs stable; add/remove sub-tasks as needed.
- Default: All main tasks MUST be subdivided into at least one sub-task by default. If a task is truly atomic, create a single sub-task `-01` mirroring the main description.
- Multi-level organization: When tasks span multiple domains, create `.Specs/<FeatureName>/tasks/` and split by domain:
  - `.Specs/<FeatureName>/tasks/tasks.md` — index with overview and links to domain files.
  - Domain files: `database_tasks.md`, `service_tasks.md`, `interface_tasks.md`, `infra_tasks.md`, etc.
- Cross-references: Each domain file must include dependencies to tasks in other files where applicable. The index must summarize dependencies across domains.
- Consistency: Apply editing rules (numbering, dependencies, [P], test-first) uniformly across all task files.

## Tasks Index Requirements
- The feature-level `tasks.md` (next to `spec.md`) must list which task IDs live in which domain files so contributors can find them quickly.
