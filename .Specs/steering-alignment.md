# Steering Alignment and Precedence (.kiro ↔ features)

- Source integration: Incorporate relevant guidance from `.kiro/steering/*` and `.kiro/specs/*` into feature docs under `features/`.
- Precedence rule: If `.kiro` conflicts with a feature spec in `features/`, the `features/` spec prevails — unless the `.kiro` guidance is clearly superior (simpler, safer, or more consistent) without violating acceptance criteria, in which case update the feature spec to adopt it.
- Merge notes per feature: Each feature should list which `.kiro` sections it adopted and note any conflicts and resolutions.
- Non-goals: Do not alter SKUs; avoid wrappers around frameworks; keep schema changes minimal and focused on the feature.

Alignment highlights for this repo:
- Stack: Node.js 18 + Express, PostgreSQL, Docker (matches).
- Practices: Structured logging, migrations, unit + integration tests (adopted in plans).
- Deployment: Multi-stage Docker builds and healthchecks (already present).
