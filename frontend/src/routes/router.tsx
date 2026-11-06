import { NotFound, RouteError, RouteFrame } from './route-frame'
import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { paths } from './paths'

const PublicLayout = lazy(() => import('@/components/layout/public-layout'))
const AppShell = lazy(() => import('@/components/layout/app-shell'))
const Landing = lazy(() => import('@/features/dashboard/landing-page'))
const Features = lazy(() =>
  import('@/features/dashboard/landing-page').then((m) => ({ default: m.FeaturesPage })),
)
const Pricing = lazy(() => import('@/features/billing/pricing-page'))
const Auth = lazy(() => import('@/features/auth/auth-page'))
const Onboarding = lazy(() => import('@/features/auth/onboarding-page'))
const Dashboard = lazy(() => import('@/features/dashboard/dashboard-page'))
const Workspaces = lazy(() => import('@/features/workspaces/workspaces-page'))
const Projects = lazy(() => import('@/features/projects/projects-page'))
const ProjectDetail = lazy(() => import('@/features/projects/project-detail'))
const Tasks = lazy(() => import('@/features/tasks/tasks-page'))
const TaskDetail = lazy(() => import('@/features/tasks/task-detail'))
const Clients = lazy(() => import('@/features/clients/clients-page'))
const Team = lazy(() => import('@/features/team/team-page'))
const Tickets = lazy(() => import('@/features/tickets/tickets-page'))
const TicketDetail = lazy(() => import('@/features/tickets/ticket-detail'))
const AI = lazy(() => import('@/features/ai/ai-page'))
const Knowledge = lazy(() => import('@/features/knowledge-base/knowledge-page'))
const Analytics = lazy(() => import('@/features/analytics/analytics-page'))
const Notifications = lazy(() => import('@/features/dashboard/notifications-page'))
const Settings = lazy(() => import('@/features/settings/settings-page'))
const Billing = lazy(() => import('@/features/billing/billing-page'))
const PortalLayout = lazy(() =>
  import('@/features/clients/portal').then((m) => ({ default: m.PortalLayout })),
)
const PortalDashboard = lazy(() =>
  import('@/features/clients/portal').then((m) => ({ default: m.PortalDashboard })),
)
const PortalProjects = lazy(() =>
  import('@/features/clients/portal').then((m) => ({ default: m.PortalProjects })),
)
const PortalProject = lazy(() =>
  import('@/features/clients/portal').then((m) => ({ default: m.PortalProjectDetail })),
)

export const router = createBrowserRouter([
  {
    element: <RouteFrame />,
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        children: [
          { path: paths.home, element: <Landing /> },
          { path: paths.features, element: <Features /> },
          { path: paths.pricing, element: <Pricing /> },
        ],
      },
      { path: paths.login, element: <Auth key="login" mode="login" /> },
      { path: paths.signup, element: <Auth key="signup" mode="signup" /> },
      { path: '/forgot-password', element: <Auth key="forgot" mode="forgot" /> },
      { path: '/reset-password', element: <Auth key="reset" mode="reset" /> },
      { path: '/verify-email', element: <Onboarding verification /> },
      { path: '/onboarding', element: <Onboarding /> },
      { path: paths.workspaces, element: <Workspaces /> },
      { path: '/account', element: <Navigate to="/w/studio/settings/account" replace /> },
      {
        path: paths.workspace,
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'projects', element: <Projects /> },
          { path: 'projects/:projectId', element: <ProjectDetail /> },
          { path: 'projects/:projectId/:section', element: <ProjectDetail /> },
          { path: 'tasks', element: <Tasks /> },
          { path: 'tasks/:taskId', element: <TaskDetail /> },
          { path: 'clients', element: <Clients /> },
          { path: 'clients/:clientId', element: <Clients /> },
          { path: 'team', element: <Team /> },
          { path: 'team/:memberId', element: <Team /> },
          { path: 'tickets', element: <Tickets /> },
          { path: 'tickets/:ticketId', element: <TicketDetail /> },
          { path: 'ai', element: <AI /> },
          { path: 'knowledge', element: <Knowledge /> },
          { path: 'knowledge/:documentId', element: <Knowledge /> },
          { path: 'analytics', element: <Analytics /> },
          { path: 'notifications', element: <Notifications /> },
          { path: 'settings', element: <Settings /> },
          { path: 'settings/:section', element: <Settings /> },
          { path: 'billing', element: <Billing /> },
        ],
      },
      {
        path: paths.portal,
        element: <PortalLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <PortalDashboard /> },
          { path: 'projects', element: <PortalProjects /> },
          { path: 'projects/:projectId', element: <PortalProject /> },
          { path: 'tickets', element: <Tickets portal /> },
          { path: 'tickets/:ticketId', element: <TicketDetail portal /> },
          { path: 'notifications', element: <Notifications portal /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
