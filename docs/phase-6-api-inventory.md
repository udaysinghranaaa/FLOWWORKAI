# Phase 6 API inventory

OpenAPI 0.6 is authoritative for payloads. Every operation requires current authentication and tenant/project authorization. Unsafe methods require CSRF; status changes and edits are versioned.

- `GET /api/v1/work-management/config`
- `GET /api/v1/workspaces/{workspaceId}/projects`
- `POST /api/v1/workspaces/{workspaceId}/projects`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}`
- `PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/members`
- `POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/members`
- `DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/members/{userId}`
- `GET /api/v1/workspaces/{workspaceId}/tasks`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks`
- `POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}`
- `PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}`
- `PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/move`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/board`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/subtasks`
- `POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/subtasks`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments`
- `POST /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments`
- `PATCH /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments/{commentId}`
- `DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments/{commentId}`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/activity`
- `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/activity`
- `GET /api/v1/workspaces/{workspaceId}/dashboard`
