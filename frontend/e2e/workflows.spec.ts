import { test, expect } from '@playwright/test'

test('drags a task between Kanban columns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/w/studio/projects/p-orbit/board')
  const handle = page.getByRole('button', {
    name: 'Drag Design the onboarding experience',
    exact: true,
  })
  await expect(handle).toBeVisible()
  const source = await handle.boundingBox()
  const target = await page.getByRole('region', { name: 'Done', exact: true }).boundingBox()
  if (!source || !target) throw new Error('Kanban drag regions were not measurable')
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2 + 12)
  await page.mouse.move(target.x + target.width / 2, target.y + 90, { steps: 15 })
  await page.mouse.up()
  await expect(
    page
      .getByRole('region', { name: 'Done', exact: true })
      .getByRole('link', { name: 'Design the onboarding experience', exact: true }),
  ).toBeVisible()
})

test('edits an existing task and adds a comment', async ({ page }) => {
  await page.goto('/w/studio/tasks/FW-101')
  await page.getByRole('button', { name: 'Edit task', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Edit task', exact: true })
  await form.getByLabel('Task title').fill('Refine the onboarding demo')
  await form.getByLabel('Priority', { exact: true }).selectOption('urgent')
  await form.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Refine the onboarding demo' })).toBeVisible()
  await page
    .getByLabel('Add a comment', { exact: true })
    .fill('A thoughtful demo update for the next review.')
  await page.getByRole('button', { name: 'Post comment', exact: true }).click()
  await expect(page.getByText('A thoughtful demo update for the next review.')).toBeVisible()
})

test('creates and edits a fictional client', async ({ page }) => {
  await page.goto('/w/studio/clients')
  await page.getByRole('button', { name: 'Add client', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Add a client' })
  await form.getByLabel('Company name').fill('Cedar Demo')
  await form.getByLabel('Contact name').fill('Quinn James')
  await form.getByLabel('Email', { exact: true }).fill('quinn@cedar.example')
  await form.getByLabel('Industry').fill('Creative services')
  await form.getByRole('button', { name: 'Add client', exact: true }).click()
  await page.getByRole('link', { name: 'Cedar Demo', exact: true }).click()
  await page.getByRole('button', { name: 'Edit client' }).click()
  await page.getByRole('dialog').getByLabel('Contact name').fill('Quinn Taylor')
  await page.getByRole('button', { name: 'Save client' }).click()
  await expect(page.getByText('Quinn Taylor', { exact: true })).toBeVisible()
})

test('adds a demo invitation without sending email', async ({ page }) => {
  await page.goto('/w/studio/team')
  await page.getByRole('button', { name: 'Invite member' }).click()
  await page.getByRole('dialog').getByLabel('Email address').fill('casey-new@northstar.example')
  await page.getByRole('button', { name: 'Add demo invitation' }).click()
  await expect(page.getByText('casey-new@northstar.example', { exact: true })).toBeVisible()
  await expect(page.getByText('Pending demo invitation added · no email sent')).toBeVisible()
})

test('keeps a new internal note out of the client-facing thread', async ({ page }) => {
  await page.goto('/w/studio/tickets/ticket-1')
  await page.getByRole('combobox', { name: 'Reply visibility' }).selectOption('internal')
  await page
    .getByLabel('Internal note', { exact: true })
    .fill('Private demo critique for the staff team only.')
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  await expect(page.getByText('Private demo critique for the staff team only.')).toBeVisible()
  // Client-side navigation retains the same in-memory repository, rather than refreshing fixtures.
  await page.getByRole('button', { name: 'Search workspace' }).click()
  await page.getByRole('dialog').getByRole('searchbox').fill('Clients')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Clients/ })
    .click()
  await page.getByRole('link', { name: 'Orbit', exact: true }).click()
  await page.getByRole('link', { name: /Explore client portal/ }).click()
  await page
    .getByRole('navigation', { name: 'Client portal navigation' })
    .getByRole('link', { name: 'Support', exact: true })
    .click()
  await page
    .getByRole('link', { name: 'Review the updated dashboard navigation', exact: true })
    .click()
  await expect(page.getByText('Private demo critique for the staff team only.')).toHaveCount(0)
})

test('opens a scripted AI sample and refuses an arbitrary live prompt honestly', async ({
  page,
}) => {
  await page.goto('/w/studio/ai')
  await page.getByRole('button', { name: 'Summarize my projects', exact: true }).click()
  await expect(page.getByText(/4 projects are represented in this workspace/)).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Message FlowAI preview' })
    .fill('Please use a real model now')
  await page.getByRole('button', { name: 'Send demo message' }).click()
  await expect(page.getByText(/Live AI integration is unavailable/)).toBeVisible()
})

test('switches workspace without showing previous workspace records', async ({ page }) => {
  await page.goto('/w/studio/projects')
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
  if (await page.getByRole('button', { name: 'Open navigation' }).isVisible()) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
  }
  await page.getByRole('button', { name: /^Switch workspace/ }).click()
  await page.getByRole('menuitem', { name: 'Atelier Lab', exact: true }).click()
  await expect(page).toHaveURL(/\/w\/lab\/dashboard$/)
  await expect(page.getByText('Your next chapter starts here')).toBeVisible()
  await expect(page.getByText('Orbit platform redesign', { exact: true })).toHaveCount(0)
})

for (const width of [320, 768, 1024])
  test(`fits important layouts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    for (const route of [
      '/w/studio/dashboard',
      '/w/studio/projects/p-orbit/board',
      '/w/studio/settings',
      '/w/studio/ai',
      '/pricing',
    ]) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        route,
      ).toBe(true)
    }
  })
