# Phase 4 · Database and authentication interview notes

Read alongside the [architecture guide](phase-4-database-auth-architecture.md), source and tests. These are explanations of the implementation, not claims that live Atlas or a production deployment passed. Learn each concept's boundary and failure case as well as its happy path.

## 1. MongoDB versus SQL

**What:** MongoDB stores BSON documents; relational databases organize data through tables and relational constraints. **Why:** This project chose MongoDB for flexible domain documents and its planned ecosystem; this does not remove relational business invariants. **How:** Reference users/sessions and use transactions for changes spanning documents. **Code:** `await session.withTransaction(operation)`. **Interview answer:** “I choose based on access patterns and integrity needs. MongoDB does not automatically enforce cross-document foreign keys or tenant ownership; our services must enforce those.”

## 2. Mongoose schemas and models

**What:** A schema describes fields, validation, options and indexes; a model performs operations on one collection/connection. **Why:** Runtime persistence needs constraints beyond TypeScript. **How:** Auth models are bound to an explicit connection rather than hidden global initialization. **Code:** `connection.model('User', userSchema, 'users')`. **Interview answer:** “Mongoose supplies casting and validation, but database unique indexes and application transactions remain essential.”

## 3. Indexes

**What:** Indexes accelerate selected query patterns; unique indexes also enforce uniqueness. **Why:** An existence check alone loses a concurrent-signup race. **How:** Define unique normalizedEmail, token/family hashes, user/session lookup and TTL purge indexes. **Code:** `userSchema.index({ normalizedEmail: 1 }, { unique: true })`. **Interview answer:** “The index is the final uniqueness authority. I handle duplicate-key races safely and never drop customer data to make index creation succeed.” Indexes add write/storage cost; TTL deletion is delayed and cannot replace expiry checks.

## 4. Password hashing

**What:** A password hash is a deliberately expensive verifier, not reversible password storage. **Why:** Slow memory-hard verification raises the cost of offline guessing. **How:** Argon2id uses a salt and encoded parameters; this project starts at 19 MiB, two iterations, parallelism one, with bounded concurrency. **Code:** `await argon2.verify(storedHash, submittedPassword)`. **Interview answer:** “I store an Argon2id verifier, never the password, and tune resource costs under production load rather than assuming one setting fits every server.”

## 5. Hashing versus encryption

**What:** Hashing produces a digest; encryption is reversible with a key. **Why:** Recovery tokens need comparison, not retrieval. **How:** Use SHA-256 for high-entropy random tokens and Argon2id for human passwords. **Code:** `createHash('sha256').update(randomToken).digest('hex')`. **Interview answer:** “Fast SHA-256 is suitable for a 256-bit random token, but unsuitable alone for a guessable password. Encoding such as base64 is neither encryption nor password protection.”

## 6. JWT structure

**What:** A signed JWT has encoded header, claims and signature. Its payload is readable; signing does not encrypt it. **Why:** Short-lived access credentials can carry minimal routing/identity claims. **How:** jose verifies an explicit algorithm, type, issuer, audience, age/expiry and subject/session/version formats. **Code:** `await jwtVerify(token, key, { algorithms: ['HS256'], issuer, audience })`. **Interview answer:** “Decoding is not verification. Even a verified JWT must pass our current database session/account checks.” The omitted options in this small fragment are present in the real implementation.

## 7. Access versus refresh credentials

**What:** Access authorizes a short request window; refresh exchanges a longer-lived session secret for replacement credentials. **Why:** Separation limits access exposure without forcing frequent password entry. **How:** Default access is ten minutes; refresh idle seven days and absolute 30 days, with rotation/history limits. **Code:** `const next = await service.refresh(refreshCookie)`. **Interview answer:** “The refresh secret is opaque, random, hashed in storage and consumed by one endpoint. It is not a second long-lived access JWT.”

## 8. HttpOnly cookies

**What:** HttpOnly prevents direct JavaScript cookie reads; Secure restricts transmission to HTTPS. **Why:** Keep credentials out of localStorage and ordinary frontend state. **How:** Production uses host-only __Host- cookies, Secure/HttpOnly/SameSite=Lax/Path=/; local HTTP uses separate names. **Code:** `res.cookie(name, value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })`. **Interview answer:** “HttpOnly reduces token exfiltration, but XSS can still issue requests. Cookies also create a CSRF boundary, so these flags are not the whole authentication design.”

## 9. CSRF

**What:** A hostile site can try to trigger requests carrying a browser's ambient cookies. **Why:** Cookie-bearing mutations need an intent check independent of those cookies. **How:** Bootstrap a signed nonce bound to a pre-session/session, send it in X-CSRF-Token, and verify cookie/signature/time/Origin/Fetch Metadata. **Code:** `router.use(csrf.protect)`. **Interview answer:** “I protect login and recovery too, not just logged-in writes. SameSite is defense in depth; the signed session-bound token prevents naive cookie-injection double-submit weaknesses.”

## 10. CORS

**What:** CORS controls browser access to cross-origin responses. **Why:** Local React and Express use different ports, while cookies still need explicit browser permission. **How:** Allow exact configured origins with credentials and the CSRF header, never wildcard credentials. **Code:** `fetch(apiUrl, { credentials: 'include' })`. **Interview answer:** “CORS is not authorization or a non-browser firewall. I still authenticate requests and validate CSRF for unsafe methods.”

## 11. Authentication versus authorization

**What:** Authentication proves identity; authorization decides access to a resource/action. **Why:** A valid account does not imply membership in a company or permission to read its projects. **How:** Phase 4 resolves only global identity; Phase 5 must resolve server-side tenant membership/capabilities. **Code:** `const principal = res.locals.principal`. **Interview answer:** “The current user can view their own account. I do not turn a demo workspace or a client-supplied role into a server permission.”

## 12. Express authentication middleware

**What:** Reusable middleware validates credentials and attaches trusted typed context. **Why:** Individual controllers should not invent inconsistent auth checks. **How:** requireAuth verifies the cookie JWT and queries current user/session ownership, status, epoch and expiry. **Code:** `router.get('/me', authenticated, controller.me)`. **Interview answer:** “The middleware rejects missing/invalid credentials with canonical 401 and fails closed when MongoDB is unavailable. DTOs never expose the internal session ledger.”

## 13. Signup lifecycle

**What:** Signup creates a pending identity and verification action. **Why:** It must prevent duplicate accounts and avoid granting an unverified company membership. **How:** CSRF/rates/schema → Argon2id → unique user/action transaction → post-commit mail dispatch → generic 202. **Code:** `await service.register(validated.body)`. **Interview answer:** “A unique index handles concurrent requests; a generic response avoids explicitly revealing whether an address already exists. Signup creates no authenticated workspace.”

## 14. Login lifecycle

**What:** Login checks knowledge of the password and current account policy before creating a device session. **Why:** A matching password alone is insufficient for a disabled/unverified account. **How:** Normalize email, verify real/dummy Argon2 hash, check policy, serialize the user guard, create family, issue HttpOnly cookies and safe identity. **Code:** `await service.login(credentials, boundedUserAgent)`. **Interview answer:** “I return generic invalid-credential errors and reveal verification-required only after a correct password. No raw credential is returned in JSON.”

## 15. Session refresh

**What:** Rotation replaces a refresh secret and records its consumption. **Why:** A copied old token should not remain silently usable. **How:** A transaction compares the current hash, checks user/expiry, updates hash/history and commits. Recognized replay commits family revocation before 401. **Code:** `findOneAndUpdate({ _id, hashedRefreshToken: oldHash }, update, { session })`. **Interview answer:** “Concurrent raw rotations fail closed. The browser deduplicates requests and coordinates tabs rather than weakening replay detection.”

## 16. Session revocation

**What:** Revocation removes ongoing credential authority before expiry. **Why:** Logout/reset must stop already-issued access JWTs when immediate invalidation is promised. **How:** Check live sessions on every protected request; logout-all/reset increment the user authentication epoch and revoke families transactionally. **Code:** `claims.version === currentUser.authVersion`. **Interview answer:** “Short token lifetime alone is not immediate logout. Our database checks make subsequent requests fail after revocation.”

## 17. Password reset security

**What:** Reset replaces password knowledge through a separate one-time recovery proof. **Why:** Recovery can otherwise bypass every login protection. **How:** Generic request, random hashed 15-minute token, purpose-separated collection, atomic consumption/password replacement/epoch increment/session revocation. **Code:** `{ hashedToken, consumedAt: null, expiresAt: { $gt: now } }`. **Interview answer:** “I never email a password or store the raw reset token. A reused/expired link fails, and an old password snapshot cannot race reset to create a valid session.”

## 18. Email verification

**What:** Verification establishes control of an address, not legal identity. **Why:** It is a prerequisite to this project's real login policy. **How:** One-hour random action, hashed storage, explicit POST consumption and throttled replacement. **Code:** `await service.verifyEmail(token)`. **Interview answer:** “Opening a link is not the mutation; the user confirms it. Development capture is not real delivery, and production never returns verification tokens through the API.”

## 19. Frontend session restoration

**What:** Reconstruct verified identity after reload using server cookies. **Why:** An in-memory UI flag or localStorage user object cannot authenticate a request. **How:** TanStack Query checks me, the client refreshes/retries once on 401, and the route renders loading/error/guest/identity states. **Code:** `useQuery({ queryKey: ['auth', 'me'], queryFn: loadSession })`. **Interview answer:** “The query cache is the one session-state owner. Private content waits for verification, refresh is single-flight, and logout clears cache after server confirmation.”

## 20. Backend error handling

**What:** Normalize operational/validation/dependency/unexpected failures into stable safe contracts. **Why:** Raw driver/JWT/mail errors can expose secrets or confuse clients. **How:** Reuse Phase 3 envelopes/request IDs and safe structured diagnostics; database availability errors become 503. **Code:** `throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in again to continue.')`. **Interview answer:** “Clients receive a safe code/message and correlation ID, not stack traces, connection strings or token material.”

## 21. Database connection lifecycle

**What:** Startup, readiness, recovery and shutdown of the actual database client. **Why:** A listening HTTP socket does not prove required storage is usable. **How:** Bound initial selection/connect/socket waits, disable buffering, create reviewed indexes, gate readiness on connection state and close in bounded shutdown hooks. **Code:** `isReady: () => healthy && connection.readyState === 1`. **Interview answer:** “Initial failure stops startup; detected loss disables readiness. I report live connectivity failures honestly rather than treating local mocks as Atlas verification.”

## 22. Common security mistakes

**What:** Storing plaintext passwords, trusting decoded JWTs, persistent browser tokens, wildcard credentialed CORS, missing pre-auth CSRF, client roles and destructive production tests. **Why:** These shortcuts bypass intended trust boundaries. **How:** Use explicit server validation, private cookie credentials, current session checks and isolated guarded databases. **Code:** `assertSafeTestDatabase(uri, 'test', generatedName)`. **Interview answer:** “I test failure paths and never disable a security control to make integration tests green.”

## 23. Preparing multi-tenant authorization

**What:** A trusted user context is only the input to future tenant policy. **Why:** Authentication must not become cross-workspace access. **How:** Future middleware must resolve requested workspace membership/resource relationships from the database and pass required tenant context to scoped repositories. **Code:** `authorizeWorkspace(principal.userId, validatedWorkspaceId) // future, not implemented`. **Interview answer:** “A well-formed ID or a JWT claim is not proof of membership. Phase 4 deliberately creates no workspace grants.”

## 24. Testing authentication flows

**What:** Exercise real state transitions, concurrency and browser behavior in controlled environments. **Why:** Testing a stubbed password check cannot prove MongoDB uniqueness, transactions or cookie integration. **How:** Generated loopback replica sets, random test keys, strict cleanup guards, Supertest, jose adversarial claims and real compiled-backend Playwright flows. **Code:** `await Promise.all([rotate(oldCookie), rotate(oldCookie)])`. **Interview answer:** “I assert replay revocation, reset races, safe DTOs and CSRF—not just a successful login. Test cleanup cannot use the owner's Atlas URI.”

## 25. Production deployment considerations

**What:** Running securely includes secrets, TLS, origins/proxies, indexes, mail, shared limits, monitoring, recovery and runtime updates. **Why:** Passing local tests is not a deployment/security certification. **How:** Same-site HTTPS, real SMTP, managed random signing secrets, reviewed proxy topology and shared/edge abuse protection; verify Atlas before release. **Code:** `npm.cmd run db:check` after build and private configuration. **Interview answer:** “I distinguish implemented controls from verified deployment. This session's Atlas check was blocked by URI parsing; isolated MongoDB results do not erase that blocker.”

Study order: database and persistence (1–3, 21), credentials and browser boundaries (4–12), complete request/state transitions (13–18), frontend lifecycle/errors (19–20), testing and operational boundaries (22–25). Trace signup → captured verification → login → me → rotation → reset/logout through the actual files, then explain why each invalid/racing request is rejected. Consult the [final report](phase-4-final-report.md) for the actual test outcomes.
