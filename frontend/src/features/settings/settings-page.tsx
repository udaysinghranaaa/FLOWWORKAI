import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Upload,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
} from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { useUIStore, type Theme } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import { Card, Avatar, Badge, Tabs } from '@/components/ui/display'
import { Field, Input, Textarea, RadioGroup, Switch } from '@/components/ui/fields'
import { ConfirmationDialog } from '@/components/ui/overlays'
import { PageHeader, SectionHeading, IntegrationNotice } from '@/components/shared/page'

const workspaceSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(120),
  description: z.string().max(500),
})
function WorkspaceSettings() {
  const { workspace, repository, workspaceId, base, members } = useDemo()
  const [logo, setLogo] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof workspaceSchema>>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: workspace?.name ?? '', description: workspace?.description ?? '' },
  })
  useEffect(
    () => () => {
      if (logo) URL.revokeObjectURL(logo)
    },
    [logo],
  )
  return (
    <div className="settings-grid">
      <div>
        <Card>
          <SectionHeading
            title="Workspace profile"
            subtitle="Changes affect this demo session only"
          />
          <div className="logo-preview">
            <span className="workspace-logo">
              {logo ? <img src={logo} alt="Local workspace logo preview" /> : workspace?.initials}
            </span>
            <div>
              <label htmlFor="workspace-logo" className="btn btn-secondary">
                <Upload size={15} />
                Choose local logo
              </label>
              <Input
                className="sr-only"
                id="workspace-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (
                    file.size > 2 * 1024 * 1024 ||
                    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
                  ) {
                    toast.error('Choose a PNG, JPEG or WebP under 2 MiB.')
                    return
                  }
                  setLogo(URL.createObjectURL(file))
                }}
              />
              <p className="field-hint">Local image preview only. Nothing is uploaded.</p>
            </div>
          </div>
          <form
            className="form-stack"
            noValidate
            onSubmit={handleSubmit((v) => {
              repository.updateWorkspace(workspaceId, v)
              toast.success('Workspace profile updated in demo')
            })}
          >
            <Field label="Workspace name" id="settings-workspace-name" error={errors.name?.message}>
              <Input
                id="settings-workspace-name"
                {...register('name')}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'settings-workspace-name-error' : undefined}
              />
            </Field>
            <Field
              label="Company description"
              id="settings-workspace-description"
              error={errors.description?.message}
            >
              <Textarea id="settings-workspace-description" {...register('description')} />
            </Field>
            <div className="form-actions">
              <Button type="submit" variant="primary">
                Save demo workspace
              </Button>
            </div>
          </form>
        </Card>
        <Card>
          <SectionHeading title="Demo data" />
          <p className="muted">
            Restore the original fictional records. This removes in-memory changes across all demo
            workspaces.
          </p>
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            Reset all demo data
          </Button>
        </Card>
      </div>
      <aside>
        <Card>
          <SectionHeading title="Team access overview" />
          <p className="large-number">{members.length}</p>
          <p className="muted">Demo profiles in this workspace</p>
          <div className="role-list">
            {['Owner', 'Admin', 'Manager', 'Member', 'Client'].map((r) => (
              <div className="row-between" key={r}>
                <span>{r}</span>
                <Badge>{members.filter((m) => m.role === r).length}</Badge>
              </div>
            ))}
          </div>
          <Button asChild className="w-full">
            <Link to={`${base}/team`}>
              Manage team preview
              <ArrowUpRight size={14} />
            </Link>
          </Button>
        </Card>
        <IntegrationNotice>
          Actual role changes, workspace export, ownership transfer, and deletion require backend
          enforcement.
        </IntegrationNotice>
      </aside>
      <ConfirmationDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Restore original demo data?"
        description="All local project, task, client, ticket and notification edits will be removed. This does not affect any server."
        confirmLabel="Reset demo"
        onConfirm={() => {
          repository.reset()
          toast.success('Original demo data restored')
        }}
      />
    </div>
  )
}
const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters.').max(120),
  title: z.string().max(120),
})
function AccountSettings() {
  const [saved, setSaved] = useState({ name: 'Jordan Lee', title: 'Studio director' })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: saved,
  })
  return (
    <Card className="settings-form-card">
      <SectionHeading
        title="Account profile preview"
        subtitle="Local presentation only · no authenticated account exists"
      />
      <div className="person-row">
        <Avatar name={saved.name} size="large" />
        <div>
          <strong>{saved.name}</strong>
          <p className="muted">jordan@northstar.example</p>
        </div>
      </div>
      <form
        className="form-stack"
        noValidate
        onSubmit={handleSubmit((v) => {
          setSaved(v)
          toast.success('Profile preview updated on this page only')
        })}
      >
        <Field id="profile-name" label="Display name" error={errors.name?.message}>
          <Input id="profile-name" {...register('name')} />
        </Field>
        <Field id="profile-title" label="Job title" error={errors.title?.message}>
          <Input id="profile-title" {...register('title')} />
        </Field>
        <Field id="profile-email" label="Email">
          <Input id="profile-email" value="jordan@northstar.example" readOnly />
        </Field>
        <p className="field-hint">
          The navigation persona remains Jordan Lee. Real profile updates, email verification,
          sessions, and password changes need the authentication backend.
        </p>
        <div className="form-actions">
          <Button variant="primary" type="submit">
            Save profile preview
          </Button>
        </div>
      </form>
    </Card>
  )
}
function AppearanceSettings() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  return (
    <Card className="settings-form-card">
      <SectionHeading
        title="Make yourself at home"
        subtitle="Theme preference is saved in this browser"
      />
      <div className="theme-previews">
        {[
          { value: 'dark', Icon: Moon, label: 'Dark' },
          { value: 'light', Icon: Sun, label: 'Light' },
          { value: 'system', Icon: Monitor, label: 'System' },
        ].map(({ value, Icon, label }) => (
          <button
            key={value}
            className={`theme-preview ${value} ${theme === value ? 'selected' : ''}`}
            onClick={() => setTheme(value as Theme)}
            aria-pressed={theme === value}
          >
            <span className="theme-miniature">
              <i />
              <i />
              <i />
            </span>
            <span>
              <Icon size={16} />
              {label}
            </span>
          </button>
        ))}
      </div>
      <RadioGroup
        label="Appearance preference"
        value={theme}
        onValueChange={(v) => setTheme(v as Theme)}
        options={[
          { label: 'Dark', value: 'dark' },
          { label: 'Light', value: 'light' },
          { label: 'System', value: 'system' },
        ]}
      />
      <p className="field-hint">
        System follows your operating system. Dark is the default for a new browser.
      </p>
    </Card>
  )
}
function NotificationSettings() {
  const [assignment, setAssignment] = useState(true)
  const [milestone, setMilestone] = useState(true)
  const [digest, setDigest] = useState(false)
  return (
    <Card className="settings-form-card">
      <SectionHeading
        title="A little less noise"
        subtitle="Preference controls only · no delivery service is connected"
      />
      <Switch
        label="Task assignment previews"
        description="A sample preference for work assigned to you."
        checked={assignment}
        onCheckedChange={setAssignment}
      />
      <Switch
        label="Milestone updates"
        description="A sample preference for project delivery updates."
        checked={milestone}
        onCheckedChange={setMilestone}
      />
      <Switch
        label="Weekly email digest"
        description="Preview the preference. No email will be sent."
        checked={digest}
        onCheckedChange={setDigest}
      />
      <Button
        variant="primary"
        onClick={() =>
          toast.info(
            'Preference preview updated for this page. No delivery settings were sent to a server.',
          )
        }
      >
        Save preference preview
      </Button>
    </Card>
  )
}
export default function SettingsPage() {
  const { section } = useParams()
  const { base } = useDemo()
  const navigate = useNavigate()
  const tab = ['account', 'appearance', 'notifications'].includes(section ?? '')
    ? section!
    : 'workspace'
  return (
    <>
      <PageHeader
        eyebrow="A WORKSPACE THAT FEELS LIKE YOURS"
        title="Settings"
        description="A few thoughtful defaults. A little room to make it your own."
        action={
          <Badge>
            <Settings size={13} />
            Frontend preferences
          </Badge>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate(`${base}/settings${value === 'workspace' ? '' : `/${value}`}`)
        }
        items={[
          { value: 'workspace', label: 'Workspace', content: <WorkspaceSettings /> },
          { value: 'account', label: 'Account', content: <AccountSettings /> },
          { value: 'appearance', label: 'Appearance', content: <AppearanceSettings /> },
          { value: 'notifications', label: 'Notifications', content: <NotificationSettings /> },
        ]}
      />
      <div className="settings-links">
        <Link to={`${base}/billing`}>
          <CreditCard size={18} />
          Billing & plan previews
          <ArrowUpRight size={15} />
        </Link>
        <div>
          <ShieldCheck size={18} />
          Real security controls arrive with the backend.
        </div>
      </div>
    </>
  )
}
