import type { ClientSession } from 'mongoose'
import type { TenantModels } from './tenant.models.js'
export function createTenantRepository(models: TenantModels) {
  return {
    organization: (id: string, session?: ClientSession) =>
      models.Organization.findOne({ _id: id }).session(session ?? null),
    organizationMembership: (organizationId: string, userId: string, session?: ClientSession) =>
      models.OrganizationMembership.findOne({ organizationId, userId, status: 'active' }).session(
        session ?? null,
      ),
    workspace: (organizationId: string, workspaceId: string, session?: ClientSession) =>
      models.Workspace.findOne({ _id: workspaceId, organizationId }).session(session ?? null),
    workspaceMembership: (
      organizationId: string,
      workspaceId: string,
      userId: string,
      session?: ClientSession,
    ) =>
      models.WorkspaceMembership.findOne({
        organizationId,
        workspaceId,
        userId,
        status: 'active',
      }).session(session ?? null),
  }
}
