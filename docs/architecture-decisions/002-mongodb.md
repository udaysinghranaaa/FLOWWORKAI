# ADR 002 · MongoDB Atlas with Mongoose

Status: accepted stack constraint for blueprint; infrastructure not provisioned. Date: 2026-11-06.

## Context

The requested MERN stack specifies MongoDB Atlas/Mongoose and MongoDB Vector Search. Agency records contain bounded flexible metadata alongside strongly related memberships, grants and billing facts. MongoDB's lack of foreign keys is a material cost, not a claim that relationships do not matter.

## Decision

Use shared tenant collections with required workspaceId, strict Mongoose/Zod validation, explicit reference checks, compound indexes and short transactions on a replica-set deployment. Embed bounded values; reference growing collections. Use index migrations and query-plan evidence. Monetary values are integers in currency minor units, not binary floating-point prices.

## Alternatives and trade-offs

PostgreSQL offers foreign keys, row-level security and strong relational reporting; it would be a credible unconstrained choice for billing and access relationships. MongoDB matches the chosen stack and consolidates document/vector infrastructure, but application code must enforce relationship/tenant consistency and aggregation discipline. Database-per-tenant is reserved for a separately evaluated enterprise requirement.

## Consequences

Transactions support cross-document invariants but add operational requirements; transaction callbacks must contain no external side effects. Application validation cannot be replaced by Mongoose ref/populate. Atlas backup/vector capabilities and costs must be verified on the selected tier; local basic MongoDB is not a complete vector environment. Large analytics may eventually need materialized views or a separate read store, justified by measured workload.

Validation: duplicate/index tests, two-tenant references, owner concurrency, query explain plans and restore drills. Related: [data design](../04-database-design.md), [MongoDB transaction documentation](https://www.mongodb.com/docs/manual/core/transactions/).
