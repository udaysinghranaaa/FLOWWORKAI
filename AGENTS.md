# FlowWork AI engineering rules

Current authorized scope: **Phase 6 projects, tasks, project memberships, persistent Kanban, assignments, subtasks, comments, activity, My Tasks and workspace metrics**, explicitly authorized on November 12, 2026. Preserve Phases 1-5 and the separate demo. Keep backend/.env untouched and secrets private. Rotation remains unconfirmed; develop/test only on generated isolated databases. Phase 5 and Phase 6 live schema installation require separate intended-environment approval. No Atlas seeding/cleanup or business writes. Do not start Phase 7.

Phase 2 frontend and Phase 3 foundation remain preserved. Phase 4 database identity, JWT cookies, live sessions, verification/reset, CSRF and optional same-process DNS configuration remain authoritative for authentication. Phase 5 is explicitly authorized by the latest brief and adds a company parent, workspace memberships, invitations and current database RBAC. Read docs/phase-5-multi-tenant-architecture.md, docs/phase-5-final-report.md and ADR 010 for current policy. Historical phase reports remain unchanged.

Mandatory folder convention: React/dependencies in root frontend/ and Express/dependencies in root backend/. Never create nested frontend/backend or apps/web/api. Preserve backend/.env, DNS configuration and ignore rules. Rotation is still required; no Atlas business writes or schema initialization until privately completed. Live connectivity is not tenant acceptance. Stop after Phase 6.

1. Read the documentation and repository structure before changing files. Start with README.md, docs/01-product-requirements.md and the relevant architecture documents.
2. Implement only the requested phase; distinguish planned behavior from implemented behavior.
3. Preserve existing working functionality.
4. Never perform unrelated refactoring.
5. Use readable, modular, typed code when implementation is authorized.
6. Validate all input on the backend using explicit schemas and field allowlists.
7. Enforce authorization server-side for HTTP, sockets, jobs, downloads and AI tools.
8. Enforce strict tenant isolation, including references, caches, logs and vector retrieval.
9. Never hardcode secrets or commit credentials, private documents or environment files containing secrets.
10. Write meaningful tests for behavior, boundaries and failure cases when implementing features.
11. Keep UI visually consistent with docs/06-ui-ux-design-system.md.
12. Document important architectural decisions in docs/architecture-decisions/.
13. Never claim untested code is tested. Report actual verification and limitations.
14. Report exact changed files.
15. Explain implementation and request flow at a level appropriate to the change.
16. Explicitly mention unresolved risks.
17. Do not automatically advance to another phase.
18. Require approval for destructive or sensitive changes. Complete reversible preparation before requesting approval; honor authorization already given in the session.

Use the planned stack in README.md. Do not add microservices, Kubernetes, new infrastructure or dependencies without a documented need. Documentation examples are contracts, not claims of executable implementation.

Phase 6 current decisions: read docs/phase-6-architecture.md, docs/phase-6-final-report.md and ADR 011. Work models use existing tenant transaction guards. Keep explicit project role ceilings, plain-text comments, atomic activities, bounded board pagination and the separate demo. Schema plan is read-only by default; do not apply it to Atlas without separate approval for the intended environment.
