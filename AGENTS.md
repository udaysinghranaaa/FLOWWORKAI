# FlowWork AI engineering rules

Current authorized scope: **Phase 2 frontend development**, explicitly requested after Phase 1. Build a clearly labeled frontend-only demo; do not implement backend, real authentication, payments, AI calls or server infrastructure. Stop after Phase 2.

Phase 2 frontend implementation and verification are complete. Read docs/phase-2-frontend-architecture.md and docs/phase-2-final-report.md for the actual running scope. Phase 3 remains unauthorized until explicitly requested.

Mandatory folder convention: all React code and frontend dependencies/configuration belong in root-level `frontend/`. Future Express code/dependencies belong in root-level `backend/`, which remains absent or empty until Phase 3. Do not create `apps/web`, `apps/api`, `frontend/frontend` or `backend/backend`. Keep environment variables separate and never expose backend secrets to the browser. Preserve Phase 1 documents; update affected path conventions only, and document current implementation in the Phase 2 report.

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
