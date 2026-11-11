# Phase 3 · Backend interview notes

These explanations refer to the executable Express foundation in `backend/`. They do not imply that database, authentication or SaaS business features exist. Code fragments are teaching examples unless they name an implemented function.

## 1. What is Node.js?

Node.js is a JavaScript runtime built on V8, with APIs for HTTP, files, processes and other server operations. TypeScript is checked/compiled by the toolchain; the production entrypoint runs emitted JavaScript with Node.

```powershell
npm.cmd run build
node --env-file-if-exists=.env dist/server.js
```

Interview answer: “Node lets me use JavaScript on the server. In this project, strict TypeScript catches mistakes before compilation and Node runs the resulting ESM application.” The direct command above honors NODE_ENV; the actual production script adds `--production`.

## 2. Why Express?

Express provides routing, middleware composition and HTTP response helpers without imposing database or service structure. This project adds explicit modules and boundaries rather than putting every handler in one server file.

```ts
router.get('/health', controller.health)
```

Interview answer: “Express supplies the HTTP layer; our services own application behavior. That keeps framework concerns out of computations and future repositories.”

## 3. How does the event loop work?

JavaScript callbacks usually execute on one main thread. Node coordinates ready I/O callbacks through its event loop; the operating system and, for some APIs, libuv workers perform work outside that thread. Promise continuations run through the microtask queue. `async` does not automatically move CPU work off the main thread.

```ts
console.log('A')
Promise.resolve().then(() => console.log('C'))
console.log('B') // A, B, then C in this example
```

Interview answer: “Node can handle many waiting I/O operations efficiently, but a long synchronous calculation blocks other requests. Large CPU jobs need a worker or an appropriate separate processing boundary.” Avoid promising a universal timer ordering across all execution contexts.

## 4. What is non-blocking I/O?

The caller can yield while an I/O operation is pending rather than holding the JavaScript thread until it completes. `await` pauses that async function, not every request in the process.

```ts
import { readFile } from 'node:fs/promises'
const text = await readFile('openapi.json', 'utf8')
```

Interview answer: “I await asynchronous APIs and avoid synchronous I/O in request handlers. That preserves concurrency while other requests wait for their own I/O.” Phase 3 examples compute locally; they do not pretend to query a database.

## 5. What is middleware?

Middleware receives request, response and `next`. It can add context, respond, or forward execution/error. Order matters: request ID must precede parsing errors so those failures remain correlated.

```ts
app.use(requestId)
app.use(express.json({ limit: '16kb' }))
app.use('/api/v1', router)
app.use(errorHandler)
```

Interview answer: “Middleware composes cross-cutting HTTP policies. A handler must either finish a response or pass control, and it must avoid doing both.” The actual foundation also places logging, Helmet, CORS and throttling before the router.

## 6. What is REST?

REST is an architectural style involving resource representations, a uniform interface and stateless interactions. A versioned JSON HTTP API can follow these conventions without claiming every REST constraint is fully demonstrated by a small example.

```http
GET /api/v1/health
Accept: application/json
```

Interview answer: “Our version prefix makes contract evolution explicit, HTTP methods express intent, and status codes communicate outcomes. Stateless request handling does not mean future durable server data is forbidden.”

## 7. GET, POST, PUT, PATCH and DELETE

| Method | Typical purpose | Semantic expectations |
|---|---|---|
| GET | Read a representation | Safe and idempotent; avoid mutation |
| POST | Submit a command or create under a collection | Not generally idempotent; use explicit idempotency design when needed |
| PUT | Replace a known resource representation | Idempotent under the contract |
| PATCH | Apply a partial update | Idempotence depends on the patch operation |
| DELETE | Remove a resource | Idempotent intended effect; repeated response status can differ |

```http
POST /api/v1/example/validate
Content-Type: application/json

{"label":"Learning HTTP","count":2}
```

This implemented POST validates/computes and stores nothing. Future project PUT/PATCH/DELETE endpoints are not operational. Idempotent means repeating the intended effect does not change it further, not that every response is byte-identical.

## 8. HTTP status codes

| Code | Meaning in this foundation |
|---|---|
| 200 | Successful health/example result |
| 204 | Allowed CORS preflight, no body |
| 400 | Malformed JSON/transport |
| 403 | Rejected Origin |
| 404 | Missing or production-disabled route |
| 413 / 415 | Body too large / unsupported representation |
| 422 | Well-formed input fails the request schema |
| 429 | Too many requests |
| 500 | Unexpected server failure, sanitized |
| 503 | Not ready or draining |

```ts
throw new ApiError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.')
```

Interview answer: “I preserve the Phase 1 distinction between transport errors and schema errors. Clients use stable codes to choose behavior and request IDs to report a failure.” Future authentication will need its own tested 401/403 semantics.

## 9. Controller versus service

Controllers translate HTTP context into typed service calls and map results into responses. Services implement computation/application decisions without importing Express.

```ts
// Illustrative controller structure; actual code uses typed validated locals.
const result = await service.validate(res.locals.validated.body)
sendSuccess(res, result)
```

Interview answer: “Keeping req/res out of services lets me exercise behavior without HTTP, and reuse it from another adapter later.” Routes assemble schemas/controllers; they should not become a second service layer.

## 10. Dependency injection

Pass collaborators explicitly instead of constructing hidden global dependencies. `createApp` accepts configuration, logger, lifecycle state, clock and an example service.

```ts
const app = createApp({
  config,
  now: () => new Date('2026-01-01T00:00:00Z'),
  exampleService,
})
```

Interview answer: “Tests inject deterministic time or a failing service through the real boundary. We can verify 500 handling without adding an unsafe public crash endpoint or mocking Express internals.”

## 11. Why Zod?

TypeScript types disappear at runtime. Zod verifies untrusted values and produces a parsed typed result, with trimming/defaults/coercion only where explicitly allowed.

```ts
const input = z.strictObject({
  label: z.string().trim().min(2).max(80),
  count: z.number().int().min(1).max(100),
})
const result = input.safeParse(body)
```

Interview answer: “Backend validation is the trust boundary even if the React form also validates. We reject unknown fields and put the parsed body/query/params into locals rather than overwriting Express 5's read-only query getter.” Validation alone does not prove authorization or tenant ownership.

## 12. Centralized error handling

Known operational errors carry authored public guidance. Parser/Zod failures are normalized; unexpected errors return generic 500 and safe server-side diagnostics. The four-argument Express signature identifies the error handler. Express 5 forwards rejected async handler promises automatically.

```ts
// Simplified shape; implementation also handles headers already sent.
const handler: ErrorRequestHandler = (error, req, res, next) => {
  const apiError = normalizeError(error)
  if (res.headersSent) { next(apiError); return }
  res.status(apiError.statusCode).json({
    error: { code: apiError.code, message: apiError.message, details: apiError.details },
    meta: { requestId: req.id },
  })
}
```

Interview answer: “One normalization boundary keeps envelopes consistent and prevents raw exceptions leaking. We log bounded stack frames without raw exception messages or request bodies.”

## 13. CORS

CORS tells browsers which origins may read cross-origin responses. It does not stop non-browser callers, who can omit/spoof Origin. This API explicitly rejects untrusted origins and exposes its request ID header to allowed frontend pages.

```js
fetch('http://localhost:5000/api/v1/health')
```

Interview answer: “The API matches exact configured origins, with credentials disabled. Future cookie sessions need an explicit credentialed-origin and CSRF policy; merely enabling CORS is not authentication.” An origin is scheme, host and port, without a path.

## 14. Helmet

Helmet configures HTTP headers such as nosniff, frame/referrer protections and CSP. Production HSTS tells browsers to prefer HTTPS after receiving the policy over a secure connection; it does not provide a TLS listener.

```ts
app.use(helmet({ strictTransportSecurity: false })) // local HTTP illustration
```

Interview answer: “Security headers reduce specific browser risks. They complement schema validation and future authorization; they cannot implement those controls.” The actual app enables HSTS in production only.

## 15. Rate limiting

Rate limiting bounds request volume per key/window. The current API uses 120 requests/minute/IP with a process-local store, standard headers and a canonical 429 response. Health probes/preflight are exempt.

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

Interview answer: “Memory limits are useful for one process but reset on restart and do not coordinate replicas. I keep trust proxy false until we know the real topology so arbitrary forwarded headers cannot become a bypass.” Sensitive future login/AI routes will need additional policy.

## 16. Request IDs

A request ID correlates header, response body and structured logs. A bounded valid UUID header can be reused; invalid input is replaced with crypto.randomUUID.

```http
X-Request-ID: 123e4567-e89b-42d3-a456-426614174000
```

Interview answer: “A user can give support the ID so operators find matching logs without collecting request bodies. It is a correlation value, not a trusted user ID or permission token.” Caller-supplied IDs are not guaranteed globally unique.

## 17. How React communicates with Express

The browser sends HTTP requests with fetch or a client wrapper, checks status, then parses the documented DTO/envelope. CORS must allow the browser's actual Vite origin. Production integration should centralize error handling and pass cancellation signals.

```js
const response = await fetch('http://localhost:5000/api/v1/health')
const payload = await response.json()
if (!response.ok) throw new Error(payload.error.code)
console.log(payload.data.status)
```

Interview answer: “The frontend will consume typed responses through a replaceable API boundary and TanStack Query for remote state. Phase 3 preserves its working in-memory demo and only documents a health connectivity check.” Never put backend secrets in a Vite variable.

## 18. Why separate app.ts and server.ts?

The factory composes the HTTP application; the entrypoint owns env reading, sockets and process signals. Importing the factory should not start a listener or require production configuration.

```ts
await request(createApp({ config })).get('/api/v1/health').expect(200)
```

Interview answer: “Supertest exercises real middleware on isolated apps without binding the configured production port. The compiled entrypoint is separately smoke-tested to catch build/module/startup failures.”

## 19. Graceful shutdown

Stop admission, mark readiness false, let active requests finish, close idle connections, run actual resource cleanup hooks, and enforce a deadline. Failure should produce a nonzero exit rather than a process that never terminates.

```ts
process.on('SIGTERM', () => { void running.shutdown('SIGTERM') })
```

This fragment illustrates the trigger; the implementation adds idempotent signal registration, one shared shutdown promise, a 10-second deadline, fatal-error handling and failure logging. Interview answer: “I distinguish liveness from readiness during drain and make repeated signals safe. No MongoDB/queue cleanup is claimed because no such clients exist.”

## 20. Why a modular monolith?

A single deployable backend keeps operations and cross-module transactions simpler while modules preserve ownership through routes, schemas, controllers and services. Module boundaries should later include repositories and explicit tenant context.

```text
one backend process
  health module
  development example module
  future explicitly authorized domain modules
```

Interview answer: “We start with one deployment and clear internal boundaries. Independent services would add network, consistency and operations costs before demonstrated need.” This is a design tradeoff; it does not guarantee future boundaries will remain correct without tests/review.

## Walk through an actual request

Client → Express global middleware → versioned router → route validation middleware → controller → service → controller envelope → client. Completion logging runs when the response finishes. The router/middleware relationship is nested; global security middleware runs before routing, and route-specific schema middleware runs after route selection.

For `POST /api/v1/example/validate`, the app first assigns an ID, logging/security/CORS/limits and bounded JSON parsing. The example route requires JSON and validates all body/query/params. The controller receives normalized locals, invokes the pure service, and returns 200 with data/meta. Invalid count returns 422 without calling the service. Malformed JSON fails earlier with 400; unexpected service rejection reaches the central generic 500 path.

Suggested study order: runtime/event loop/non-blocking I/O (1–4), HTTP/middleware/statuses (5–8), application boundaries/validation/errors (9–12), security/correlation (13–16), integration/testability/shutdown/modularity (17–20). Then trace `backend/src/app.ts`, the example module, and its integration tests together. Practice explaining the limitations as clearly as the implemented behavior.
