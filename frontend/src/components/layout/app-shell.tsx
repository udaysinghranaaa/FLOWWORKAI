import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  CheckSquare2,
  FolderKanban,
  Users,
  Building2,
  LifeBuoy,
  Sparkles,
  BookOpen,
  ChartNoAxesCombined,
  Bell,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Plus,
  Menu as MenuIcon,
  Sun,
  Moon,
  Monitor,
  ArrowUpRight,
  ArrowRight,
  Globe,
} from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { useUIStore } from '@/stores/ui-store'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, Breadcrumb } from '@/components/ui/display'
import { Menu, Popover, Tooltip, Sheet, Modal, ConfirmationDialog } from '@/components/ui/overlays'
import { SearchInput } from '@/components/ui/fields'
import { DemoLabel, EmptyState } from '@/components/shared/page'
import { cn, formatDate } from '@/lib/utils'
import TaskForm from '@/features/tasks/task-form'

const navigation = [
  { label: 'Dashboard', path: 'dashboard', icon: LayoutDashboard },
  { label: 'My Tasks', path: 'tasks', icon: CheckSquare2 },
  { label: 'Projects', path: 'projects', icon: FolderKanban },
  { label: 'Clients', path: 'clients', icon: Building2 },
  { label: 'Team', path: 'team', icon: Users },
  { label: 'Support Tickets', path: 'tickets', icon: LifeBuoy },
  { label: 'FlowAI Assistant', path: 'ai', icon: Sparkles },
  { label: 'Knowledge Base', path: 'knowledge', icon: BookOpen },
  { label: 'Analytics', path: 'analytics', icon: ChartNoAxesCombined },
  { label: 'Notifications', path: 'notifications', icon: Bell },
]
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="FlowWork AI home">
      <span className="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 5h14v4H9v3h8v4H9v5H5z" fill="currentColor" />
          <path d="m16 2 5 5-5 5" stroke="#67E8F9" strokeWidth="2" />
        </svg>
      </span>
      {!compact && (
        <span>
          flowwork <span className="brand-ai">AI</span>
        </span>
      )}
    </Link>
  )
}
function ThemeMenu() {
  const { theme, setTheme } = useUIStore()
  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor
  return (
    <Menu
      label="Appearance"
      trigger={
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Icon size={18} />
        </Button>
      }
      items={[
        { label: 'Dark theme', onSelect: () => setTheme('dark') },
        { label: 'Light theme', onSelect: () => setTheme('light') },
        { label: 'System theme', onSelect: () => setTheme('system') },
      ]}
    />
  )
}
function CommandSearch() {
  const { projects, tasks, clients, base } = useDemo()
  const open = useUIStore((s) => s.commandOpen)
  const setOpen = useUIStore((s) => s.setCommandOpen)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const pages = navigation.map((n) => ({
    id: n.path,
    title: n.label,
    category: 'Page',
    href: `${base}/${n.path}`,
  }))
  const results = [
    ...pages,
    ...projects.map((p) => ({
      id: p.id,
      title: p.name,
      category: 'Project',
      href: `${base}/projects/${p.id}`,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: 'Task',
      href: `${base}/tasks/${t.id}`,
    })),
    ...clients.map((c) => ({
      id: c.id,
      title: c.name,
      category: 'Client',
      href: `${base}/clients/${c.id}`,
    })),
  ]
    .filter((x) => x.title.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 10)
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(!useUIStore.getState().commandOpen)
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [setOpen])
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Find your next step"
      description="Search pages, projects, tasks and clients in this demo workspace."
      className="command-dialog"
    >
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search the workspace…"
        label="Search workspace"
      />
      <div className="command-results">
        {results.map((x) => (
          <button
            className="command-result"
            key={`${x.category}-${x.id}`}
            onClick={() => {
              setOpen(false)
              setSearch('')
              navigate(x.href)
            }}
          >
            <span>
              <Badge>{x.category}</Badge>
              {x.title}
            </span>
            <ArrowRight size={15} />
          </button>
        ))}
        {!results.length && (
          <EmptyState
            title="No results found"
            description="Try a page name, project, or task title."
          />
        )}
      </div>
      <p className="command-help">Tab through results · Enter to open · Escape to close</p>
    </Modal>
  )
}
export default function AppShell() {
  const { workspace, workspaceId, state, base, notices, repository, projects } = useDemo()
  const { collapsed, toggleSidebar, setCommandOpen, taskCreateOpen, setTaskCreateOpen } =
    useUIStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const section = location.pathname.split('/')[3] ?? 'dashboard'
  const title =
    navigation.find((n) => n.path === section)?.label ??
    (section === 'billing' ? 'Billing & plans' : section === 'settings' ? 'Settings' : 'Workspace')
  const unread = notices.filter((n) => !n.read).length
  const activeProjectId = location.pathname.includes('/projects/')
    ? projects.find((p) => location.pathname.split('/')[4] === p.id)?.id
    : undefined
  if (!workspace)
    return (
      <main className="standalone">
        <EmptyState
          title="Workspace not found"
          description="This preview contains Northstar Studio and Atelier Lab."
          action={
            <Button asChild>
              <Link to="/workspaces">Choose workspace</Link>
            </Button>
          }
        />
      </main>
    )
  const sidebar = (mobile = false) => (
    <div className={cn('sidebar-inner', collapsed && !mobile && 'is-collapsed')}>
      <div className="sidebar-brand">
        <Brand compact={collapsed && !mobile} />
        {(!collapsed || mobile) && <Badge>DEMO</Badge>}
      </div>
      <Menu
        label="Demo workspaces"
        trigger={
          <button className="workspace-button">
            <span className="workspace-initials">
              <span className="sr-only">Switch workspace </span>
              {workspace.initials}
            </span>
            {(!collapsed || mobile) && (
              <>
                <span>
                  <strong>{workspace.name}</strong>
                  <small>Agency workspace</small>
                </span>
                <ChevronDown size={14} />
              </>
            )}
          </button>
        }
        items={[
          ...state.workspaces.map((w) => ({
            label: w.name,
            onSelect: () => {
              setMobileOpen(false)
              setTaskCreateOpen(false)
              setCommandOpen(false)
              navigate(`/w/${w.id}/dashboard`)
            },
          })),
          { label: 'All workspaces', href: '/workspaces' },
        ]}
      />
      <p className="nav-group-label">{collapsed && !mobile ? '•••' : 'WORKSPACE'}</p>
      <nav aria-label={mobile ? 'Mobile workspace navigation' : 'Workspace navigation'}>
        {navigation.map(({ label, path, icon: Icon }, index) => (
          <div key={path} className={index === 6 ? 'nav-section-start' : ''}>
            <Tooltip label={label}>
              <NavLink
                aria-label={collapsed && !mobile ? label : undefined}
                to={`${base}/${path}`}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'nav-link',
                  location.pathname.startsWith(`${base}/${path}`) && 'active',
                )}
              >
                <Icon size={18} aria-hidden="true" />
                {(!collapsed || mobile) && (
                  <>
                    <span>{label}</span>
                    {path === 'ai' && <span className="ai-nav-badge">AI</span>}
                    {path === 'notifications' && unread > 0 && (
                      <span className="nav-count">{unread}</span>
                    )}
                  </>
                )}
              </NavLink>
            </Tooltip>
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        {(!collapsed || mobile) && (
          <Link to={`${base}/portal/dashboard`} className="portal-shortcut">
            <Globe size={16} />
            <span>Client portal preview</span>
            <ArrowUpRight size={14} />
          </Link>
        )}
        <NavLink
          aria-label="Settings"
          to={`${base}/settings`}
          className={({ isActive }) => cn('nav-link', isActive && 'active')}
          onClick={() => setMobileOpen(false)}
        >
          <Settings size={18} />
          {(!collapsed || mobile) && <span>Settings</span>}
        </NavLink>
        {(!collapsed || mobile) && (
          <div className="sidebar-person">
            <Avatar name="Jordan Lee" />
            <div>
              <strong>Jordan Lee</strong>
              <small>Owner · demo persona</small>
            </div>
          </div>
        )}
      </div>
    </div>
  )
  return (
    <div className={cn('app-shell', collapsed && 'sidebar-collapsed')}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="desktop-sidebar">{sidebar()}</aside>
      <Sheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Workspace navigation"
        description="Browse the frontend demo."
        className="mobile-nav-sheet"
      >
        {sidebar(true)}
      </Sheet>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              className="mobile-only"
              size="icon"
              variant="ghost"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon size={20} />
            </Button>
            <Button
              className="desktop-only"
              size="icon"
              variant="ghost"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggleSidebar}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
            <Breadcrumb
              items={[{ label: workspace.name, href: `${base}/dashboard` }, { label: title }]}
            />
          </div>
          <div className="topbar-actions">
            <Button
              className="search-trigger"
              variant="ghost"
              onClick={() => setCommandOpen(true)}
              aria-label="Search workspace"
            >
              <Search size={17} />
              <span>Search workspace</span>
            </Button>
            <Button
              variant="primary"
              size="small"
              className="quick-create"
              aria-label="Create task"
              onClick={() => setTaskCreateOpen(true)}
            >
              <Plus size={16} />
              <span>Create</span>
            </Button>
            <ThemeMenu />
            <Popover
              label="Recent demo notifications"
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Notifications, ${unread} unread`}
                  className="notification-button"
                >
                  <Bell size={18} />
                  {unread > 0 && <span className="notification-dot" />}
                </Button>
              }
            >
              <div className="section-heading">
                <h3>Notifications</h3>
                <Badge>{unread} unread</Badge>
              </div>
              {notices.slice(0, 3).map((n) => (
                <Link
                  onClick={() => repository.markRead(workspaceId, n.id)}
                  key={n.id}
                  className="notification-preview"
                  to={n.href}
                >
                  <span className={cn('notice-dot', n.read && 'read')} />
                  <span>
                    <strong>{n.title}</strong>
                    <small>{formatDate(n.createdAt)}</small>
                  </span>
                </Link>
              ))}
              {!notices.length && <p className="muted">All quiet in this workspace.</p>}
              <Link className="text-link" to={`${base}/notifications`}>
                Open notification center
                <ArrowRight size={14} />
              </Link>
            </Popover>
            <Menu
              label="Jordan Lee · demo persona"
              trigger={
                <button className="profile-trigger" aria-label="Account menu JL">
                  <Avatar name="Jordan Lee" size="small" />
                </button>
              }
              items={[
                { label: 'Account settings', href: `${base}/settings/account` },
                { label: 'Billing & plans', href: `${base}/billing` },
                { label: 'Reset demo data', onSelect: () => setResetOpen(true) },
                { label: 'Leave demo', href: '/' },
              ]}
            />
          </div>
        </header>
        <div className="demo-banner">
          <DemoLabel />
          <Link to="/features">
            About this preview
            <ArrowUpRight size={12} />
          </Link>
        </div>
        <main id="main-content" className="workspace-content" key={workspaceId}>
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>Made for work that matters.</span>
          <span>FlowWork AI · Frontend preview</span>
        </footer>
      </div>
      <CommandSearch />
      {taskCreateOpen && (
        <TaskForm
          key={workspaceId}
          projectId={activeProjectId}
          onClose={() => setTaskCreateOpen(false)}
        />
      )}
      <ConfirmationDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo workspace?"
        description="This restores all fictional records and removes your in-memory demo edits. Your appearance preference stays saved."
        confirmLabel="Reset demo"
        onConfirm={() => {
          repository.reset()
          navigate(`${base}/dashboard`)
        }}
      />
    </div>
  )
}
