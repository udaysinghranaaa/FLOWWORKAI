# ADR 007 · Server-side LLM provider adapter

Status: accepted abstraction; provider/model/commercial agreement unselected with explicit Phase 10 gate. Date: 2026-11-06.

## Context

Generation and embeddings incur cost and transmit customer content externally. Models differ in output formats, dimensions, privacy guarantees, latency and billing. Browser calls would expose keys and bypass budgets.

## Decision

Only backend/worker code calls providers behind a small typed interface: generate, embed, cancellation/deadline, model identity, normalized usage and normalized errors. Application-owned Zod schemas validate outputs and citation IDs. Configure model/embedding version explicitly; avoid automatic cross-provider fallback that changes data jurisdiction or vector compatibility. Reserve usage atomically before calls and reconcile known/unknown outcomes. Start with one provider; no multi-provider orchestration platform.

## Alternatives and trade-offs

Direct SDK calls throughout controllers are faster initially but couple policy and cost logic to vendors. Broad agent frameworks can help later but introduce tool execution/state complexity before a read-only assistant needs it. Self-hosted models offer processing control at considerable operational cost; no promise that they are cheaper or equally effective without measurements.

## Consequences

Adapter enables contract tests/fakes but cannot make model behavior interchangeable. Provider region, retention, training terms and abuse logging require contractual review. Schema-valid output may still hallucinate; evaluate groundedness and permissions. Launch tools are read-only; sensitive writes require future explicit action previews, human approval and backend authorization at execution.

Validation: invalid/oversized output, citation forgery, timeouts, rate limits, uncertain usage and adversarial retrieval. Related: [security](../08-security-and-tenancy.md), [ADR 008](008-vector-search-rag.md).
