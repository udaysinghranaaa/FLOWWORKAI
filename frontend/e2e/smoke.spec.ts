import { test, expect } from '@playwright/test'

const routeCases = [
  ['/', 'One Workspace.'],
  ['/features', 'Less scattered.'],
  ['/pricing', 'Good work deserves'],
  ['/login', 'Welcome back.'],
  ['/signup', 'Make room for good work.'],
  ['/forgot-password', 'Let’s find your way back.'],
  ['/reset-password', 'A fresh start.'],
  ['/verify-email', 'A small step'],
  ['/onboarding', 'A home for your team.'],
  ['/workspaces', 'A place for every'],
  ['/w/studio/dashboard', 'Good morning, Jordan'],
  ['/w/studio/projects', 'Projects'],
  ['/w/studio/projects/p-orbit', 'Orbit platform redesign'],
  ['/w/studio/projects/p-orbit/board', 'Orbit platform redesign'],
  ['/w/studio/projects/p-orbit/milestones', 'Orbit platform redesign'],
  ['/w/studio/tasks', 'My tasks'],
  ['/w/studio/tasks/FW-101', 'Task details'],
  ['/w/studio/clients', 'Clients'],
  ['/w/studio/clients/c-orbit', 'Orbit'],
  ['/w/studio/team', 'The team'],
  ['/w/studio/team/m-maya', 'Maya Chen'],
  ['/w/studio/tickets', 'Support inbox'],
  ['/w/studio/tickets/ticket-1', 'Review the updated dashboard navigation'],
  ['/w/studio/ai', 'FlowAI Assistant'],
  ['/w/studio/knowledge', 'Knowledge base'],
  ['/w/studio/knowledge/doc-1', 'Orbit — project brief'],
  ['/w/studio/analytics', 'Workspace analytics'],
  ['/w/studio/notifications', 'Notifications'],
  ['/w/studio/settings', 'Settings'],
  ['/w/studio/settings/account', 'Settings'],
  ['/w/studio/billing', 'Billing & plans'],
  ['/w/studio/portal/dashboard', 'Welcome back, Riley'],
  ['/w/studio/portal/projects', 'Your projects'],
  ['/w/studio/portal/projects/p-orbit', 'Orbit platform redesign'],
  ['/w/studio/portal/tickets', 'Support requests'],
  ['/w/studio/portal/tickets/ticket-1', 'Review the updated dashboard navigation'],
  ['/w/studio/portal/notifications', 'Project updates'],
  ['/w/lab/dashboard', 'Good morning, Jordan'],
  ['/not-a-page', 'This page took a different path.'],
] as const

for (const [route, title] of routeCases)
  test(`renders ${route} without page overflow or errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(route)
    if (route === '/w/studio/tasks/FW-101') {
      await expect(page.getByRole('dialog', { name: 'FW-101' })).toBeVisible()
      await expect(
        page.getByRole('heading', { name: 'Design the onboarding experience' }),
      ).toBeVisible()
    } else {
      await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(title)
    }
    await expect(page.getByText('Opening FlowWork AI…')).toHaveCount(0)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true)
    expect(errors).toEqual([])
  })

test('creates projects and tasks and updates the board in memory', async ({ page }) => {
  await page.goto('/w/studio/projects')
  await page.getByRole('button', { name: 'New project' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Project name').fill('Client launch demo')
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Client launch demo' })).toBeVisible()
  await page.getByRole('button', { name: 'Create task', exact: true }).click()
  await page.getByRole('dialog').getByLabel('Task title').fill('Review the launch concept')
  await page.getByRole('dialog').getByRole('button', { name: 'Create task', exact: true }).click()
  if (await page.getByRole('button', { name: 'Open navigation' }).isVisible()) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page
      .getByRole('navigation', { name: 'Mobile workspace navigation' })
      .getByRole('link', { name: 'My Tasks', exact: true })
      .click()
  } else {
    await page
      .getByRole('navigation', { name: 'Workspace navigation', exact: true })
      .getByRole('link', { name: 'My Tasks', exact: true })
      .click()
  }
  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('Review the launch concept')
  await expect(
    page.getByRole('link', { name: 'Review the launch concept', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Board', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Status for Review the launch concept' })
    .selectOption('done')
  await expect(
    page
      .getByRole('region', { name: 'Done', exact: true })
      .getByRole('link', { name: 'Review the launch concept', exact: true }),
  ).toBeVisible()
})

test('validates account UI and preserves no fake login state', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Preview login' }).click()
  await expect(page.getByText('Enter a valid email address.')).toBeVisible()
  await page.getByLabel('Work email').fill('demo@example.com')
  await page.getByLabel('Password', { exact: true }).fill('demo-only-credentials')
  await page.getByRole('button', { name: 'Preview login' }).click()
  await expect(page.getByRole('status')).toContainText('No authentication')
  await expect(page).toHaveURL(/\/login$/)
})

test('marks notifications read and persists appearance', async ({ page }) => {
  await page.goto('/w/studio/notifications')
  await page.getByRole('button', { name: 'Mark all as read' }).click()
  await expect(page.getByText('0 unread').last()).toBeVisible()
  await page.getByRole('button', { name: 'Change theme' }).click()
  await page.getByRole('menuitem', { name: 'Light theme' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('client presentation omits internal notes and cannot open unpublished projects', async ({
  page,
}) => {
  await page.goto('/w/studio/portal/tickets/ticket-1')
  await expect(page.getByText(/Could we take another look/)).toBeVisible()
  await expect(page.getByText(/Internal review: include this/)).toHaveCount(0)
  await page.goto('/w/studio/portal/projects/p-bloom')
  await expect(
    page.getByRole('heading', { name: 'Project not available in this preview' }),
  ).toBeVisible()
})

test('opens search by keyboard and closes with Escape', async ({ page }) => {
  await page.goto('/w/studio/dashboard')
  await expect(page.getByRole('heading', { name: 'Good morning, Jordan' })).toBeVisible()
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Find your next step' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
