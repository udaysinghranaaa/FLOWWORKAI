# Phase 7 API inventory

Existing envelopes, cookie identity and signed CSRF apply. Preview is token-scoped and rate-limited. Acceptance requires matching verified email. Internal CRM requires workspace OWNER/ADMIN. Project resources require current Phase 6 manage permission. External operations require separate active portal membership and an explicit project grant.

| Method | Path |
|---|---|
| GET | `/api/v1/workspaces/{workspaceId}/clients` |
| POST | `/api/v1/workspaces/{workspaceId}/clients` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}` |
| PATCH | `/api/v1/workspaces/{workspaceId}/clients/{clientId}` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/contacts` |
| POST | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/contacts` |
| PATCH | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/contacts/{contactId}` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/invitations` |
| POST | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/invitations` |
| POST | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/invitations/{invitationId}/resend` |
| POST | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/invitations/{invitationId}/revoke` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/members` |
| PATCH | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/members/{membershipId}` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/projects` |
| POST | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/projects` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/projects/{projectId}` |
| PATCH | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/projects/{projectId}` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/activity` |
| POST | `/api/v1/portal/invitations/preview` |
| POST | `/api/v1/portal/invitations/accept` |
| GET | `/api/v1/portal/clients` |
| GET | `/api/v1/portal/clients/{clientId}` |
| GET | `/api/v1/portal/clients/{clientId}/projects` |
| GET | `/api/v1/portal/clients/{clientId}/projects/{projectId}` |
| GET | `/api/v1/portal/clients/{clientId}/members` |
| PATCH | `/api/v1/portal/clients/{clientId}/members/{membershipId}` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/projects/{projectId}/resources` |
| POST | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/projects/{projectId}/resources` |
| GET | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/projects/{projectId}/resources/{resourceId}` |
| PATCH | `/api/v1/workspaces/{workspaceId}/clients/{clientId}/projects/{projectId}/resources/{resourceId}` |
| GET | `/api/v1/portal/clients/{clientId}/projects/{projectId}/resources` |
| POST | `/api/v1/portal/clients/{clientId}/projects/{projectId}/resources` |
| GET | `/api/v1/portal/clients/{clientId}/projects/{projectId}/resources/{resourceId}` |
| PATCH | `/api/v1/portal/clients/{clientId}/projects/{projectId}/resources/{resourceId}` |

Request bodies and bounds are generated from executable Zod schemas in backend/openapi.json. ClientSafeProject and ClientSafeResource document external allowlists. For transition policy, see phase-7-architecture.md.
