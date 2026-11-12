# ADR 012: Separate client grants and explicitly published collaboration

Accepted for Phase 7 local implementation. Live rollout remains subject to private credential rotation and separately approved Phase 5–7 schema initialization.

Reuse the Phase 4 identity, session, refresh and verification implementation. A client contact is not a user. Acceptance of an email-bound, expiring, hashed invitation creates only a client portal membership. It does not create organization, workspace or employee project memberships. The same user may legitimately hold both employee and client contexts; each route resolves its own current permissions.

Use a separate client/project grant and an allowlisted external projection. Public title and description are copied deliberately into the grant by an authorized agency administrator. Progress, milestones, feedback, change requests and deliverables live in client-scoped collaboration records. Internal project and task documents are never serialized to the portal. Adding internal fields later cannot expand the external contract.

The seven new collections share immutable tenant ownership. The resource collection has an immutable kind and explicit kind-specific transitions; reply records are separate bounded pages. Replies require an authorized published parent feedback thread. Client-specific publication avoids accidentally sharing one client's feedback or deliverable with another client on the same project. This intentionally duplicates an agency update when it is meant for multiple customers; there is no implicit broadcast.

All mutations use existing user/session transaction locks and the organization revision guard. Portal reads check current active company, workspace, client, contact, membership, project and grant. Version checks reject stale decisions. Audit events commit atomically with business changes. Creates use UUID retry keys where duplicate work is material. New deliverable versions are separate records and supersede their predecessor without inheriting or deleting its decision metadata.

Use metadata/HTTPS references only. Never fetch URLs server-side or read arbitrary files. Reject credentials, local paths, local addresses and unsafe schemes. The external provider owns actual file access; database authorization does not privatize a public URL. No uploads, object store, malware scanning or expiring download claims are added.

Internal workspace OWNER/ADMIN manage clients, contacts, invitations, memberships and sharing. Publication and review additionally require current Phase 6 project manage permission. Project managers can use the project collaboration endpoint only for projects they currently manage. CLIENT_VIEWER is read-only. CLIENT_MEMBER and CLIENT_ADMIN can submit feedback/change requests where explicitly granted and review deliverables only with approval permission. CLIENT_ADMIN may downgrade/revoke other non-admin existing representatives only when the agency explicitly enables it. Only the agency invites or grants CLIENT_ADMIN.

Retain the independent Phase 2 client demo. Real routes use existing React providers, private cookie API transport and scoped query caches. There is no second frontend app, second password store, client-side authorization substitute, real-time transport or Phase 8 implementation.
