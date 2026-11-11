# FlowWork AI engineering rules

Current authorized scope: **Phase 4 database, secure authentication and frontend integration**, explicitly requested after Phases 1–3. Preserve the existing backend infrastructure and complete frontend demo. Implement MongoDB/Mongoose identity, JWT access cookies, rotating hashed refresh sessions, CSRF, verification/reset and real frontend identity. Preserve backend/.env and all existing values; never print secrets. Tests must use isolated local databases, never destructive operations against Atlas. Do not implement workspace/business CRUD, Socket.IO, AI/RAG or payments. Stop after Phase 4.

Phase 2 frontend implementation and verification are complete. Read docs/phase-2-frontend-architecture.md and docs/phase-2-final-report.md for its actual running scope. Phase 3 deferred earlier Redis/job-library selection. The explicit Phase 4 request authorizes identity work; no queue/business infrastructure or Phase 5 work is authorized.

Phase 3 backend foundation is implemented and verified. Read docs/phase-3-backend-architecture.md, docs/phase-3-interview-notes.md and docs/phase-3-final-report.md for its operational scope and prior results. The latest Phase 4 brief explicitly replaces opaque access tokens with short-lived JWTs while retaining database session checks and immediate revocation. Phase 5 requires new explicit authorization.

Mandatory folder convention: all React code and frontend dependencies/configuration belong in root-level `frontend/`. Express code/dependencies/configuration belong in root-level `backend/`. Do not create `apps/web`, `apps/api`, `frontend/frontend` or `backend/backend`. Keep environment variables separate and never expose backend secrets to the browser. Preserve historical reports; record current Phase 4 implementation/decisions in its guides and ADR 009. Root/API/roadmap status annotations distinguish historical plans from runtime behavior. Live Atlas connection/ping and development readiness passed in the November 11 DNS follow-up; do not infer live auth-flow acceptance from these checks or from isolated tests.

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
