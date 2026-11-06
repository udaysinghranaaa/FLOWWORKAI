# ADR 008 · MongoDB Vector Search with ACL-aware RAG

Status: accepted design direction; Atlas tier, model/dimensions and retrieval tuning need Phase 10 validation. Date: 2026-11-06.

## Context

Agency knowledge should ground answers without training a model on every tenant. Embeddings/indexes are derived data with eventual update visibility; stale ACLs or global similarity queries can leak confidential context.

## Decision

Store source metadata in knowledgeDocuments and versioned embeddings/text/offsets in knowledgeChunks. After clean extraction, chunk and embed through adapter; pin model and dimension per index generation. Configure Vector Search filter fields for workspaceId, documentId, generation, active and projectId. Resolve live allowed documents first, prefilter search by tenant and allowed set, then recheck document generation/status/ACL before prompt and before response. Only internal authorized sources at launch. Revocation excludes source metadata synchronously and purges index/binaries asynchronously.

## Alternatives and trade-offs

Keyword-only search is cheaper/simpler and should remain an option if pilot AI value is weak. Dedicated vector infrastructure can improve specialized capabilities but adds operational/data boundaries. A global vector search followed only by post-filtering is rejected as the primary security design. Fine-tuning is not a substitute for retrieval permissions or fresh factual knowledge. MongoDB consolidation reduces system count but introduces Atlas tier/index cost and capability dependencies.

## Consequences

Permission-filter scalability, index lag, dimension migrations and parser quality require explicit handling. Large allowed sets are bounded/partitioned, never converted to unfiltered search. New model dimensions require re-embedding/new index generation and a verified cutover. Source citations are checked against permitted chunk IDs, yet semantic correctness still needs evaluation. Deletion from indexes cannot retract content already sent to a provider; privacy contracts remain essential.

Validation: foreign-workspace chunks, two-client fixtures even with Client AI disabled, source revocation mid-answer, generation change, index lag, retrieval quality/cost benchmarks. Related: [MongoDB prefilter documentation](https://www.mongodb.com/docs/vector-search/query/aggregation-stages/vector-search-stage/), [data design](../04-database-design.md).
