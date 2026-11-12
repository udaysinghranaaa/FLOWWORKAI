import { Schema, type Connection, type InferSchemaType } from 'mongoose'
import { tenantFields, modelOptions, versionField } from '../work-management/work.fields.js'
const id = { type: Schema.Types.ObjectId, required: true }
const text = (max: number) => ({ type: String, default: '', maxlength: max })
const base = { ...tenantFields, version: versionField }
const client = { ...base, clientId: { ...id, immutable: true } }
export const clientSchema = new Schema(
  {
    ...base,
    name: { ...text(120), required: true },
    legalName: text(160),
    type: text(80),
    industry: text(120),
    description: text(3000),
    website: text(2048),
    email: text(254),
    phone: text(50),
    country: text(80),
    city: text(100),
    address: text(500),
    ownerId: id,
    createdBy: { ...id, immutable: true },
    status: {
      type: String,
      enum: ['lead', 'active', 'on_hold', 'inactive', 'archived'],
      default: 'lead',
    },
    tags: { type: [String], default: [] },
    allowRepresentatives: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    creationKey: { type: String, required: true },
    requestDigest: { type: String, required: true, select: false },
  },
  modelOptions,
)
clientSchema.index({ organizationId: 1, workspaceId: 1, status: 1, _id: 1 })
clientSchema.index({ workspaceId: 1, createdBy: 1, creationKey: 1 }, { unique: true })
export const contactSchema = new Schema(
  {
    ...client,
    name: { ...text(120), required: true },
    email: { ...text(254), required: true },
    title: text(120),
    phone: text(50),
    role: text(80),
    primary: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
  },
  modelOptions,
)
contactSchema.index({ clientId: 1, email: 1 }, { unique: true })
contactSchema.index(
  { clientId: 1, primary: 1 },
  { unique: true, partialFilterExpression: { primary: true, archivedAt: null } },
)
contactSchema.index({ organizationId: 1, workspaceId: 1, clientId: 1, _id: 1 })
export const portalMembershipSchema = new Schema(
  {
    ...client,
    userId: id,
    contactId: id,
    role: {
      type: String,
      enum: ['CLIENT_ADMIN', 'CLIENT_MEMBER', 'CLIENT_VIEWER'],
      required: true,
    },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    joinedAt: { type: Date, required: true },
  },
  modelOptions,
)
portalMembershipSchema.index({ clientId: 1, userId: 1 }, { unique: true })
portalMembershipSchema.index({ userId: 1, status: 1, _id: 1 })
export const portalInvitationSchema = new Schema(
  {
    ...client,
    contactId: id,
    email: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['CLIENT_ADMIN', 'CLIENT_MEMBER', 'CLIENT_VIEWER'],
      required: true,
    },
    issuedBy: id,
    tokenHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked', 'expired'],
      default: 'pending',
    },
    expiresAt: { type: Date, required: true },
    sentAt: { type: Date, required: true },
  },
  modelOptions,
)
portalInvitationSchema.index({ tokenHash: 1 }, { unique: true })
portalInvitationSchema.index(
  { clientId: 1, contactId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
)
portalInvitationSchema.index({ organizationId: 1, workspaceId: 1, clientId: 1, _id: 1 })
export const grantSchema = new Schema(
  {
    ...client,
    projectId: { ...id, immutable: true },
    title: { ...text(120), required: true },
    description: text(3000),
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    progress: { type: Boolean, default: false },
    milestones: { type: Boolean, default: false },
    deliverables: { type: Boolean, default: false },
    feedback: { type: Boolean, default: false },
    changes: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
    grantedBy: id,
    grantedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  modelOptions,
)
grantSchema.index({ clientId: 1, projectId: 1 }, { unique: true })
grantSchema.index({ organizationId: 1, workspaceId: 1, clientId: 1, status: 1, _id: 1 })
export const resourceSchema = new Schema(
  {
    ...client,
    projectId: { ...id, immutable: true },
    kind: {
      type: String,
      enum: ['progress', 'milestone', 'feedback', 'reply', 'change', 'deliverable'],
      required: true,
      immutable: true,
    },
    title: text(160),
    body: text(5000),
    status: { type: String, required: true },
    published: { type: Boolean, default: false },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    dueDate: { type: String, default: '' },
    position: { type: Number, default: 0 },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    parentId: { type: Schema.Types.ObjectId, default: null, immutable: true },
    taskId: { type: Schema.Types.ObjectId, default: null },
    url: text(2048),
    fileName: text(160),
    contentType: text(100),
    size: { type: Number, min: 0, default: null },
    revision: { type: Number, default: 1, min: 1 },
    previousId: { type: Schema.Types.ObjectId, default: null, immutable: true },
    createdBy: { ...id, immutable: true },
    decisionBy: { type: Schema.Types.ObjectId, default: null },
    decisionAt: { type: Date, default: null },
    decisionNote: text(2000),
    publishedAt: { type: Date, default: null },
    creationKey: { type: String, required: true },
    requestDigest: { type: String, required: true, select: false },
  },
  modelOptions,
)
resourceSchema.index({ clientId: 1, projectId: 1, createdBy: 1, creationKey: 1 }, { unique: true })
resourceSchema.index({
  organizationId: 1,
  workspaceId: 1,
  clientId: 1,
  projectId: 1,
  kind: 1,
  published: 1,
  _id: 1,
})
resourceSchema.index({ clientId: 1, projectId: 1, parentId: 1, _id: 1 })
resourceSchema.index({ clientId: 1, projectId: 1, kind: 1, published: 1, position: 1, _id: 1 })
resourceSchema.index({ clientId: 1, projectId: 1, kind: 1, published: 1, dueDate: 1, _id: 1 })
resourceSchema.index(
  { previousId: 1 },
  { unique: true, partialFilterExpression: { previousId: { $type: 'objectId' } } },
)
export const auditSchema = new Schema(
  {
    ...client,
    projectId: { type: Schema.Types.ObjectId, default: null },
    actorId: id,
    action: { type: String, required: true, maxlength: 100 },
    resourceId: { type: Schema.Types.ObjectId, default: null },
  },
  modelOptions,
)
auditSchema.index({ organizationId: 1, workspaceId: 1, clientId: 1, _id: 1 })
export const clientSchemas = {
  clients: clientSchema,
  clientContacts: contactSchema,
  portalMemberships: portalMembershipSchema,
  portalInvitations: portalInvitationSchema,
  clientProjectGrants: grantSchema,
  clientResources: resourceSchema,
  clientAuditEvents: auditSchema,
}
export function createClientModels(c: Connection) {
  return {
    Client: c.model('ClientOrganization', clientSchema, 'clients'),
    Contact: c.model('ClientContact', contactSchema, 'clientContacts'),
    Membership: c.model('PortalMembership', portalMembershipSchema, 'portalMemberships'),
    Invitation: c.model('PortalInvitation', portalInvitationSchema, 'portalInvitations'),
    Grant: c.model('ClientProjectGrant', grantSchema, 'clientProjectGrants'),
    Resource: c.model('ClientResource', resourceSchema, 'clientResources'),
    Audit: c.model('ClientAuditEvent', auditSchema, 'clientAuditEvents'),
  }
}
export type ClientModels = ReturnType<typeof createClientModels>
export type ClientRecord = InferSchemaType<typeof clientSchema>
export type ResourceRecord = InferSchemaType<typeof resourceSchema>
export async function ensureClientIndexes(models: ClientModels) {
  for (const m of Object.values(models)) {
    await m.createCollection()
    await m.createIndexes()
  }
}
export async function clientIndexesReady(models: ClientModels) {
  for (const m of Object.values(models)) {
    try {
      const indexes = await m.collection.listIndexes().toArray()
      for (const [keys, opts] of m.schema.indexes())
        if (
          !indexes.some(
            (i) =>
              JSON.stringify(i.key) === JSON.stringify(keys) &&
              !!i.unique === !!opts.unique &&
              JSON.stringify(i.partialFilterExpression) ===
                JSON.stringify(opts.partialFilterExpression),
          )
        )
          return false
    } catch {
      return false
    }
  }
  return true
}
