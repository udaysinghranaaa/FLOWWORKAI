import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { tenantApi, type Organization, type Workspace } from '@/services/tenant-api'
import { useSession } from '@/features/auth/use-session'
import { Card, LoadingState } from '@/components/ui/display'
import { Field, Input, Textarea, Select } from '@/components/ui/fields'
import { Button } from '@/components/ui/button'
import { Modal, ConfirmationDialog } from '@/components/ui/overlays'
import { TenantHeading, TenantError } from './tenant-context'
import { useWorkspace, useTenantRefresh } from './use-tenant'
const schema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(1000),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/),
  website: z.union([z.literal(''), z.url()]),
  industry: z.string().max(120),
  status: z.enum(['active', 'archived']),
})
function SettingsForm({
  record,
  company,
  canEdit,
  canArchive,
}: {
  record: Organization | Workspace
  company: boolean
  canEdit: boolean
  canArchive: boolean
}) {
  const refresh = useTenantRefresh(),
    [notice, setNotice] = useState(''),
    [confirm, setConfirm] = useState<z.infer<typeof schema> | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: record.name,
      description: record.description,
      slug: record.slug,
      website: 'website' in record ? record.website : '',
      industry: 'industry' in record ? record.industry : '',
      status: record.status,
    },
  })
  async function save(values: z.infer<typeof schema>) {
    setNotice('')
    try {
      if (company)
        await tenantApi.updateOrganization(record.id, {
          name: values.name,
          description: values.description,
          website: values.website,
          industry: values.industry,
          ...(canArchive ? { status: values.status } : {}),
          version: record.version,
        })
      else
        await tenantApi.updateWorkspace(record.id, {
          name: values.name,
          description: values.description,
          slug: values.slug,
          status: values.status,
          version: record.version,
        })
      await refresh()
      setNotice('Settings saved.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Settings could not be saved.')
    }
  }
  return (
    <Card>
      <p className="muted">
        {canEdit
          ? 'Changes are saved to your company database.'
          : 'You have read-only access to these settings.'}
      </p>
      <form
        className="form-stack"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          if (values.status !== record.status) setConfirm(values)
          else await save(values)
        })}
      >
        <Field
          id="setting-name"
          label={company ? 'Company name' : 'Workspace name'}
          error={errors.name?.message}
        >
          <Input id="setting-name" disabled={!canEdit} {...register('name')} />
        </Field>
        <Field id="setting-slug" label="Slug" error={errors.slug?.message}>
          <Input id="setting-slug" disabled={company || !canEdit} {...register('slug')} />
        </Field>
        <Field id="setting-description" label="Description" error={errors.description?.message}>
          <Textarea id="setting-description" disabled={!canEdit} {...register('description')} />
        </Field>
        {company && (
          <>
            <Field id="setting-website" label="Website" error={errors.website?.message}>
              <Input id="setting-website" disabled={!canEdit} {...register('website')} />
            </Field>
            <Field id="setting-industry" label="Industry">
              <Input id="setting-industry" disabled={!canEdit} {...register('industry')} />
            </Field>
            <p className="muted">Logo uploads are not available yet; no logo asset is stored.</p>
          </>
        )}
        <Field id="setting-status" label="Status">
          <Select id="setting-status" disabled={!canEdit || !canArchive} {...register('status')}>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </Select>
        </Field>
        {canEdit && (
          <Button type="submit" disabled={isSubmitting} variant="primary">
            {isSubmitting ? 'Saving…' : 'Save settings'}
          </Button>
        )}
        {notice && <p role="status">{notice}</p>}
      </form>
      <ConfirmationDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title="Change status?"
        description="Archiving restricts member access. Owners and admins retain the documented ability to restore settings."
        onConfirm={() => {
          if (confirm) void save(confirm)
          setConfirm(null)
        }}
      />
    </Card>
  )
}
function CreateWorkspace({ organizationId, close }: { organizationId: string; close: () => void }) {
  const refresh = useTenantRefresh(),
    [key] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ name: string; slug: string; description: string }>({
    resolver: zodResolver(schema.pick({ name: true, slug: true, description: true })),
    defaultValues: { name: '', slug: '', description: '' },
  })
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title="Create workspace"
      description="This creates a real workspace and founding owner membership in this company."
    >
      <form
        className="form-stack"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          try {
            await tenantApi.createWorkspace(organizationId, { ...values, creationKey: key })
            await refresh()
            close()
          } catch (error) {
            setNotice(error instanceof Error ? error.message : 'Could not create workspace.')
          }
        })}
      >
        <Field id="workspace-new-name" label="Workspace name" error={errors.name?.message}>
          <Input id="workspace-new-name" {...register('name')} />
        </Field>
        <Field id="workspace-new-slug" label="Workspace slug" error={errors.slug?.message}>
          <Input id="workspace-new-slug" {...register('slug')} />
        </Field>
        <Field id="workspace-new-description" label="Description">
          <Textarea id="workspace-new-description" {...register('description')} />
        </Field>
        {notice && <p role="alert">{notice}</p>}
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          Create workspace
        </Button>
      </form>
    </Modal>
  )
}
export default function WorkspaceSettings() {
  const context = useWorkspace()
  return (
    <div className="tenant-page">
      <TenantHeading>Workspace settings</TenantHeading>
      <SettingsForm
        key={context.workspace.id}
        record={context.workspace}
        company={false}
        canEdit={context.permissions.includes('workspace.update')}
        canArchive={context.permissions.includes('workspace.update')}
      />
    </div>
  )
}
export function CompanySettings() {
  const { orgId = '' } = useParams(),
    { data: user } = useSession(),
    [creating, setCreating] = useState(false)
  const query = useQuery({
    queryKey: ['tenant', user?.id, orgId, 'organization'],
    queryFn: () => tenantApi.organization(orgId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  if (query.isPending || (!query.isFetchedAfterMount && !query.isError))
    return <LoadingState label="Checking company access..." />
  if (query.isError)
    return (
      <TenantError
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  return (
    <main className="tenant-directory">
      <Link to="/app/workspaces">All workspaces</Link>
      <TenantHeading>{`${query.data.name} settings`}</TenantHeading>
      <div className="tenant-actions">
        {query.data.permissions.includes('organization.members.read') && (
          <Button asChild>
            <Link to={`/app/organizations/${orgId}/team`}>Company team</Link>
          </Button>
        )}
        {query.data.permissions.includes('workspace.create') && (
          <Button onClick={() => setCreating(true)}>Create workspace</Button>
        )}
      </div>
      <SettingsForm
        key={orgId}
        record={query.data}
        company
        canEdit={query.data.permissions.includes('organization.update')}
        canArchive={query.data.role === 'OWNER'}
      />
      {creating && <CreateWorkspace organizationId={orgId} close={() => setCreating(false)} />}
    </main>
  )
}
