import { options, useClientQuery, useClientRefresh } from './use-client'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  clientApi,
  clientRoot,
  clientPath,
  type Client,
  type Contact,
  type Grant,
  type PortalInvite,
  type PortalMember,
} from '@/services/client-api'
import { useWorkspace } from '@/features/workspaces/use-tenant'
import { PageHeader } from '@/components/shared/page'
import { Card, Badge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { SearchInput, Select } from '@/components/ui/fields'
import { ClientForm, ClientList, Action, QueryState, type FormField } from './client-ui'
import { ProjectCollaboration } from './project-collaboration'
const statuses = ['lead', 'active', 'on_hold', 'inactive', 'archived']
const roles = ['CLIENT_MEMBER', 'CLIENT_VIEWER', 'CLIENT_ADMIN']
const clientBody = (body: Record<string, unknown>) => ({
  ...body,
  tags: String(body.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean),
})
function fields(c?: Client): FormField[] {
  return [
    { name: 'name', label: 'Client name', required: true, value: c?.name },
    { name: 'legalName', label: 'Legal name', value: c?.legalName },
    { name: 'type', label: 'Client type', value: c?.type },
    { name: 'industry', label: 'Industry', value: c?.industry },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      max: 3000,
      value: c?.description,
    },
    { name: 'website', label: 'Website (HTTPS)', type: 'url', value: c?.website },
    { name: 'email', label: 'Contact email', type: 'email', value: c?.email },
    { name: 'phone', label: 'Phone', value: c?.phone },
    { name: 'country', label: 'Country', value: c?.country },
    { name: 'city', label: 'City', value: c?.city },
    { name: 'address', label: 'Address', value: c?.address },
    { name: 'tags', label: 'Tags (comma separated)', max: 800, value: c?.tags.join(', ') },
    {
      name: 'status',
      label: 'Lifecycle status',
      type: 'select',
      options: options(statuses),
      value: c?.status ?? 'active',
    },
    {
      name: 'allowRepresentatives',
      label: 'Allow client admins to manage existing representatives',
      type: 'checkbox',
      value: c?.allowRepresentatives,
    },
  ]
}
export default function ClientsPage() {
  const scope = useWorkspace(),
    ws = scope.workspace.id,
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [sort, setSort] = useState('oldest'),
    [adding, setAdding] = useState(false),
    refresh = useClientRefresh()
  return (
    <div className="client-management">
      <PageHeader
        title="Clients"
        description="Relationships, shared work and clear decisions."
        action={<Button onClick={() => setAdding(!adding)}>Add client</Button>}
      />
      {adding && (
        <Card>
          <h2>New client</h2>
          <ClientForm
            fields={fields()}
            label="Create client"
            submit={(body, creationKey) =>
              clientApi.save(clientRoot(ws), { ...clientBody(body), creationKey })
            }
            after={() => {
              setAdding(false)
              void refresh()
            }}
          />
        </Card>
      )}
      <div className="work-filters">
        <SearchInput value={search} onChange={setSearch} label="Search clients" />
        <Select
          aria-label="Filter client status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {options(statuses).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Sort clients" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </Select>
      </div>
      <ClientList<Client>
        key={search + status + sort}
        path={clientRoot(ws)}
        filters={{ search, status, sort }}
        empty="Your next client relationship starts here."
        render={(c) => (
          <Card>
            <Badge>{c.status}</Badge>
            <h2>
              <Link to={`/app/w/${ws}/clients/${c.id}`}>{c.name}</Link>
            </h2>
            <p>{c.industry}</p>
            <p>{c.description}</p>
          </Card>
        )}
      />
    </div>
  )
}
export function ClientDetail() {
  const { clientId = '', projectId = '' } = useParams(),
    ws = useWorkspace().workspace.id,
    path = clientPath(ws, clientId),
    query = useClientQuery<Client>(path),
    [tab, setTab] = useState('Projects'),
    [edit, setEdit] = useState(false),
    refresh = useClientRefresh()
  if (projectId) return <ProjectCollaboration ws={ws} clientId={clientId} projectId={projectId} />
  return (
    <QueryState
      pending={query.isPending || (!query.isFetchedAfterMount && !query.isError)}
      error={query.error}
      retry={() => {
        void query.refetch()
      }}
    >
      {query.data && (
        <>
          <Link to={`/app/w/${ws}/clients`}>All clients</Link>
          <PageHeader
            title={query.data.name}
            description={query.data.description}
            action={<Button onClick={() => setEdit(!edit)}>Edit client</Button>}
          />
          <Badge>{query.data.status}</Badge>
          <details>
            <summary>Account owner</summary>
            <p>Choose an active workspace administrator.</p>
            <ClientList<{ id: string; userId: string; name: string; role: string }>
              path={`/workspaces/${ws}/members`}
              render={(m) =>
                ['OWNER', 'ADMIN'].includes(m.role) ? (
                  <Action
                    run={() =>
                      clientApi.save(
                        path,
                        { version: query.data!.version, ownerId: m.userId },
                        true,
                      )
                    }
                  >
                    Assign {m.name}
                  </Action>
                ) : null
              }
            />
          </details>
          {edit && (
            <Card>
              <ClientForm
                key={query.data.version}
                fields={fields(query.data)}
                submit={(body) =>
                  clientApi.save(path, { ...clientBody(body), version: query.data!.version }, true)
                }
                after={() => {
                  setEdit(false)
                  void refresh()
                }}
              />
            </Card>
          )}
          <nav className="portal-nav" aria-label="Client profile sections">
            {['Projects', 'Contacts', 'Portal access', 'Activity'].map((t) => (
              <Button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
                {t}
              </Button>
            ))}
          </nav>
          {tab === 'Projects' && (
            <>
              <ShareForm ws={ws} path={path} />
              <ClientList<Grant>
                path={path + '/projects'}
                render={(g) => (
                  <Card>
                    <Badge>{g.status}</Badge>
                    <h2>
                      <Link to={`/app/w/${ws}/clients/${clientId}/projects/${g.projectId}`}>
                        {g.title}
                      </Link>
                    </h2>
                    <p>{g.description}</p>
                    <GrantForm path={path + '/projects/' + g.projectId} grant={g} />
                  </Card>
                )}
              />
            </>
          )}
          {tab === 'Contacts' && <Contacts path={path} />}{' '}
          {tab === 'Portal access' && <PortalAccess path={path} />}{' '}
          {tab === 'Activity' && (
            <ClientList<{ id: string; action: string; createdAt: string }>
              path={path + '/activity'}
              filters={{ sort: 'newest' }}
              render={(r) => (
                <Card>
                  <strong>{r.action.replaceAll('.', ' ')}</strong>
                  <p>{new Date(r.createdAt).toLocaleString()}</p>
                </Card>
              )}
            />
          )}
        </>
      )}
    </QueryState>
  )
}
function Contacts({ path }: { path: string }) {
  const refresh = useClientRefresh()
  const contactFields = (c?: Contact): FormField[] => [
    { name: 'name', label: 'Full name', required: true, value: c?.name },
    { name: 'email', label: 'Contact email', required: true, type: 'email', value: c?.email },
    { name: 'title', label: 'Job title', value: c?.title },
    { name: 'phone', label: 'Phone', value: c?.phone },
    { name: 'role', label: 'Contact role', value: c?.role },
    { name: 'primary', label: 'Primary contact', type: 'checkbox', value: c?.primary },
  ]
  return (
    <>
      <Card>
        <h2>Add contact</h2>
        <ClientForm
          fields={contactFields()}
          label="Create contact"
          submit={(b) => clientApi.save(path + '/contacts', b)}
          after={() => {
            void refresh()
          }}
        />
      </Card>
      <ClientList<Contact>
        path={path + '/contacts'}
        render={(c) => (
          <Card>
            <h2>{c.name}</h2>
            <p>{c.email}</p>
            <Badge>
              {c.archivedAt ? 'Archived' : c.portalAccess ? 'Portal active' : 'Contact only'}
            </Badge>
            <details>
              <summary>Edit contact</summary>
              <ClientForm
                key={c.version}
                fields={contactFields(c)}
                submit={(b) =>
                  clientApi.save(path + '/contacts/' + c.id, { ...b, version: c.version }, true)
                }
                after={() => {
                  void refresh()
                }}
              />
            </details>
            <Action
              confirm={c.archivedAt ? undefined : 'Archiving revokes this contact’s portal access.'}
              run={() =>
                clientApi.save(
                  path + '/contacts/' + c.id,
                  { version: c.version, archived: !c.archivedAt },
                  true,
                )
              }
            >
              {c.archivedAt ? 'Restore contact' : 'Archive contact'}
            </Action>
            {!c.archivedAt && !c.portalAccess && (
              <ClientForm
                fields={[
                  {
                    name: 'role',
                    label: 'Portal role for ' + c.name,
                    type: 'select',
                    options: options(roles),
                    value: 'CLIENT_MEMBER',
                  },
                ]}
                label="Invite to portal"
                submit={(b) => clientApi.save(path + '/invitations', { ...b, contactId: c.id })}
                after={() => {
                  void refresh()
                }}
              />
            )}
          </Card>
        )}
      />
    </>
  )
}
function PortalAccess({ path }: { path: string }) {
  return (
    <>
      <h2>Representatives</h2>
      <ClientList<PortalMember>
        path={path + '/members'}
        render={(m) => (
          <Card>
            <h3>{m.name ?? 'Representative'}</h3>
            <Badge>{m.role}</Badge>
            <p>{m.status}</p>
            <MemberForm path={path + '/members/' + m.id} member={m} />
          </Card>
        )}
      />
      <h2>Invitations</h2>
      <p>
        Development invitations arrive in your private local mail capture. No link is displayed
        here.
      </p>
      <ClientList<PortalInvite>
        path={path + '/invitations'}
        render={(i) => (
          <Card>
            <strong>{i.role}</strong>
            <p>
              {i.status} · Expires {new Date(i.expiresAt).toLocaleString()}
            </p>
            {i.status === 'pending' && (
              <div className="tenant-actions">
                <Action run={() => clientApi.save(path + '/invitations/' + i.id + '/resend', {})}>
                  Resend invitation
                </Action>
                <Action
                  confirm="The previous invitation will stop working."
                  run={() => clientApi.save(path + '/invitations/' + i.id + '/revoke', {})}
                >
                  Revoke invitation
                </Action>
              </div>
            )}
          </Card>
        )}
      />
    </>
  )
}
export function MemberForm({
  path,
  member,
  external = false,
}: {
  path: string
  member: PortalMember
  external?: boolean
}) {
  const refresh = useClientRefresh()
  return (
    <>
      <ClientForm
        fields={[
          {
            name: 'role',
            label: 'Representative role',
            type: 'select',
            options: options(external ? roles.slice(0, 2) : roles),
            value: member.role,
          },
        ]}
        submit={(b) => clientApi.save(path, { ...b, version: member.version }, true)}
        after={() => {
          void refresh()
        }}
      />
      <Action
        confirm="This representative will lose portal access."
        run={() => clientApi.save(path, { version: member.version, status: 'revoked' }, true)}
      >
        Revoke portal access
      </Action>
    </>
  )
}
const policies = [
  'progress',
  'milestones',
  'deliverables',
  'feedback',
  'changes',
  'approve',
] as const
function grantFields(g?: Grant): FormField[] {
  return [
    { name: 'title', label: 'Client-facing project title', required: true, value: g?.title },
    {
      name: 'description',
      label: 'Approved public description',
      type: 'textarea',
      max: 3000,
      value: g?.description,
    },
    ...policies.map((name) => ({
      name,
      label: 'Allow ' + name,
      type: 'checkbox' as const,
      value: g?.[name] ?? false,
    })),
  ]
}
function ShareForm({ ws, path }: { ws: string; path: string }) {
  const [selected, setSelected] = useState(''),
    refresh = useClientRefresh()
  return (
    <Card>
      <h2>Share a project</h2>
      <p>Choose a project, then explicitly allow the information and actions to share.</p>
      <ClientList<{ id: string; name: string }>
        path={`/workspaces/${ws}/projects`}
        render={(p) => (
          <Button aria-pressed={selected === p.id} onClick={() => setSelected(p.id)}>
            {p.name}
          </Button>
        )}
      />
      {selected && (
        <ClientForm
          key={selected}
          fields={grantFields()}
          label="Share project"
          submit={(b) => clientApi.save(path + '/projects', { ...b, projectId: selected })}
          after={() => {
            setSelected('')
            void refresh()
          }}
        />
      )}
    </Card>
  )
}
function GrantForm({ path, grant }: { path: string; grant: Grant }) {
  const refresh = useClientRefresh()
  return (
    <>
      <details>
        <summary>Visibility and permissions</summary>
        <ClientForm
          key={grant.version}
          fields={grantFields(grant)}
          submit={(b) => clientApi.save(path, { ...b, version: grant.version }, true)}
          after={() => {
            void refresh()
          }}
        />
      </details>
      <Action
        confirm={
          grant.status === 'active'
            ? 'The client will immediately lose API access to this project.'
            : undefined
        }
        run={() =>
          clientApi.save(
            path,
            { version: grant.version, status: grant.status === 'active' ? 'revoked' : 'active' },
            true,
          )
        }
      >
        {grant.status === 'active' ? 'Revoke project access' : 'Restore project access'}
      </Action>
    </>
  )
}
