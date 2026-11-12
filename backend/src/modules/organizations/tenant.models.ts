import type { Connection } from 'mongoose'
import { organizationSchema } from './organization.model.js'
import { workspaceSchema } from '../workspaces/workspace.model.js'
import {
  organizationMembershipSchema,
  workspaceMembershipSchema,
} from '../memberships/membership.models.js'
import { invitationSchema } from '../invitations/invitation.model.js'
export function createTenantModels(connection: Connection) {
  return {
    Organization: connection.model('Organization', organizationSchema, 'organizations'),
    Workspace: connection.model('Workspace', workspaceSchema, 'workspaces'),
    OrganizationMembership: connection.model(
      'OrganizationMembership',
      organizationMembershipSchema,
      'organizationMemberships',
    ),
    WorkspaceMembership: connection.model(
      'WorkspaceMembership',
      workspaceMembershipSchema,
      'workspaceMemberships',
    ),
    Invitation: connection.model('Invitation', invitationSchema, 'invitations'),
  }
}
export type TenantModels = ReturnType<typeof createTenantModels>
export async function ensureTenantIndexes(models: TenantModels) {
  for (const model of Object.values(models)) {
    await model.createCollection()
    await model.createIndexes()
  }
}
