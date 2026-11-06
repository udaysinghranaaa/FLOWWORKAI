# ADR 003 · Opaque cookie credentials and rotating session families

Status: accepted design; security review and implementation pending. Date: 2026-11-06.

## Context

A browser SaaS needs immediate logout/revocation, secure refresh, multiple devices and membership changes that apply without waiting for role-bearing tokens to expire. A user can belong to several workspaces with different roles.

## Decision

Use opaque short-lived access credentials and rotating opaque refresh credentials in Secure/HttpOnly/SameSite=Lax host-only cookies. Hash tokens server-side. Candidate access lifetime 15 min; refresh idle 7 days, absolute family maximum 30 days. Authenticate against active session records; resolve tenant membership live. Keep consumed refresh hashes until family expiry, atomically rotate, revoke family on replay and coordinate browser tabs to avoid unnecessary parallel refreshes. Synchronizer CSRF token and Origin validation protect unsafe browser requests, including pre-auth flows. Argon2id hashes passwords.

## Alternatives and trade-offs

JWTs are useful across independent verifiers but embedded roles become stale and immediate revocation still needs state; that weakens their purported stateless benefit here. Tokens in localStorage increase exposure to script theft. A single traditional opaque session cookie would be simpler, but the requested short-access/rotating-refresh separation provides bounded credential lifetimes and explicit device-family controls at added implementation cost.

## Consequences

Database/session lookup availability is on the request path; caching cannot obscure revocation. Refresh history needs a hard bound and retention. Strict replay handling may force re-login after conflicting refreshes; fail closed and document UX. Cookie auth requires CSRF and XSS protections; HttpOnly does not make XSS harmless. No workspace role is authoritative in a cookie. Sensitive Owner changes require recent server-recorded reauth.

Validation: expiry/reset/replay/rotation races, actual browser cookie/CSRF/origin behavior, log redaction and membership removal tests. Related: [security](../08-security-and-tenancy.md), [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
