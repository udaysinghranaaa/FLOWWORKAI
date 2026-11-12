import { test as base, expect, type Page } from '@playwright/test'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'

const backend = fileURLToPath(new URL('../../backend', import.meta.url))
const test = base.extend<{ isolatedAuth: void }>({
  isolatedAuth: [
    async ({ baseURL }, runTest) => {
      if (baseURL !== 'http://127.0.0.1:4173')
        throw new Error('Full-stack tests require the isolated loopback frontend.')
      const runner = spawn(process.execPath, ['.test-runtime/scripts/test-server.js'], {
        cwd: backend,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      })
      runner.stdout?.resume()
      runner.stderr?.resume()
      try {
        await new Promise<void>((resolve, reject) => {
          const deadline = setTimeout(
            () => reject(new Error('Isolated authentication backend startup timed out.')),
            85000,
          )
          runner.once('message', (message) => {
            clearTimeout(deadline)
            if (message === 'ready') resolve()
            else reject(new Error('Unexpected readiness message.'))
          })
          runner.once('error', () => {
            clearTimeout(deadline)
            reject(new Error('Unable to start the isolated backend.'))
          })
          runner.once('exit', () => {
            clearTimeout(deadline)
            reject(new Error('Isolated backend stopped before readiness.'))
          })
        })
        await runTest()
      } finally {
        if (runner.exitCode === null && runner.connected) {
          const exit = once(runner, 'exit')
          runner.send('stop')
          await Promise.race([
            exit,
            new Promise<void>((resolve) => {
              const timer = setTimeout(() => {
                runner.kill()
                resolve()
              }, 10000)
              timer.unref()
            }),
          ])
        }
      }
    },
    { auto: true, timeout: 90000 },
  ],
})
test.describe.configure({ mode: 'default' })
test.setTimeout(60000)
const password = 'Browser test passphrase 739!'
const email = () => `auth-e2e-${randomUUID()}@example.com`

async function capturedLink(
  recipient: string,
  purpose: 'verify-email' | 'reset-password' | 'invitation',
) {
  const directory = fileURLToPath(new URL('../../backend/.mail-capture/', import.meta.url))
  let link = ''
  await expect
    .poll(
      async () => {
        for (const file of await readdir(directory).catch(() => [] as string[])) {
          if (!file.endsWith('.json')) continue
          try {
            const mail = JSON.parse(await readFile(`${directory}/${file}`, 'utf8')) as {
              to: string
              purpose: string
              link: string
            }
            if (mail.to === recipient && mail.purpose === purpose) {
              link = mail.link
              return true
            }
          } catch {
            /* A capture file may still be completing. */
          }
        }
        return false
      },
      { timeout: 10000, message: 'Expected a message for this isolated controlled account.' },
    )
    .toBe(true)
  return link
}
async function signup(page: Page, recipient: string) {
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Browser Identity')
  await page.getByLabel('Work email').fill(recipient)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('verification link')
}
async function verify(page: Page, recipient: string) {
  await page.goto(await capturedLink(recipient, 'verify-email'))
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Email verified')
}
async function login(page: Page, recipient: string, value = password) {
  await page.goto('/login')
  await page.getByLabel('Work email').fill(recipient)
  await page.getByLabel('Password', { exact: true }).fill(value)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome, Browser Identity.' })).toBeVisible()
}
async function authenticated(page: Page) {
  const recipient = email()
  await signup(page, recipient)
  await verify(page, recipient)
  await login(page, recipient)
  return recipient
}

test('signup, captured verification, login, reload, identity and logout use the real backend', async ({
  page,
}) => {
  const recipient = await authenticated(page)
  await expect(page.getByText(recipient)).toBeVisible()
  await expect(page.getByText(/no workspace or subscription has been created/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(recipient)).toBeVisible()
  const cookies = await page.context().cookies()
  expect(
    cookies
      .filter((cookie) => ['fw_access', 'fw_refresh'].includes(cookie.name))
      .every((cookie) => cookie.httpOnly && cookie.sameSite === 'Lax'),
  ).toBe(true)
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => /token|session|auth/i.test(key)),
    ),
  ).toBe(false)
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
})
test('unverified email cannot sign in, and invalid credentials remain generic', async ({
  page,
}) => {
  const recipient = email()
  await signup(page, recipient)
  await page.goto('/login')
  await page.getByLabel('Work email').fill(recipient)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Verify your email')
  await page.getByLabel('Password', { exact: true }).fill('Incorrect test password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Email or password is incorrect')
})
test('private routes redirect without flashing a private identity', async ({ page }) => {
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await expect(page.getByText('REAL AUTHENTICATED ACCOUNT')).toHaveCount(0)
})
test('expired access cookies restore through rotating refresh credentials', async ({ page }) => {
  const recipient = await authenticated(page)
  const previous = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'fw_refresh',
  )?.value
  await page.context().clearCookies({ name: 'fw_access' })
  await page.reload()
  await expect(page.getByText(recipient)).toBeVisible()
  const replacement = (await page.context().cookies()).find(
    (cookie) => cookie.name === 'fw_refresh',
  )?.value
  expect(Boolean(previous && replacement && previous !== replacement)).toBe(true)
})
test('password reset consumes captured mail and invalidates a second browser session', async ({
  page,
  browser,
}) => {
  const recipient = await authenticated(page)
  const secondContext = await browser.newContext(),
    second = await secondContext.newPage()
  try {
    await login(second, recipient)
    await page.goto('/forgot-password')
    await page.getByLabel('Work email').fill(recipient)
    await page.getByRole('button', { name: 'Request reset link' }).click()
    await expect(page.getByRole('status')).toContainText('reset instructions')
    await page.goto(await capturedLink(recipient, 'reset-password'))
    await page.getByLabel('New password', { exact: true }).fill('Changed browser passphrase 852!')
    await page.getByLabel('Confirm new password').fill('Changed browser passphrase 852!')
    await page.getByRole('button', { name: 'Reset password', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Password updated')
    await second.reload()
    await expect(second.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
    await login(page, recipient, 'Changed browser passphrase 852!')
  } finally {
    await secondContext.close()
  }
})
test('logout-all revokes another active browser session', async ({ page, browser }) => {
  const recipient = await authenticated(page)
  const secondContext = await browser.newContext(),
    second = await secondContext.newPage()
  try {
    await login(second, recipient)
    await page.getByRole('button', { name: 'Sign out all devices' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await second.reload()
    await expect(second.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  } finally {
    await secondContext.close()
  }
})
test('CSRF blocks unsafe cookie-authenticated requests and keeps the session active', async ({
  page,
}) => {
  await authenticated(page)
  const status = await page.evaluate(
    async () =>
      (
        await fetch('http://127.0.0.1:5081/api/v1/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
  )
  expect(status).toBe(403)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome, Browser Identity.' })).toBeVisible()
})
test('authenticated identity page passes accessibility and keeps demo/theme separate', async ({
  page,
}) => {
  await authenticated(page)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
  await page.getByRole('link', { name: 'Explore Demo Workspace', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Good morning, Jordan' })).toBeVisible()
  await page.getByRole('button', { name: 'Change theme' }).click()
  await page.getByRole('menuitem', { name: 'Light theme' }).click()
  await page.goto('/account')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('heading', { name: 'Welcome, Browser Identity.' })).toBeVisible()
})

async function createCompany(page: Page, name: string, slug: string) {
  await page.goto('/app/onboarding')
  await page.getByLabel('Company name', { exact: true }).fill(name)
  await page.getByLabel('Company slug', { exact: true }).fill(slug)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByLabel('Workspace name', { exact: true }).fill(`${name} workspace`)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Create company', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your company is ready.' })).toBeVisible()
  await page.getByRole('link', { name: 'Enter workspace' }).click()
  await expect(page.getByRole('heading', { name: `${name} workspace`, exact: true })).toBeVisible()
  return page.url().match(/\/app\/w\/([^/]+)/)![1]!
}
async function tenantRequest(page: Page, path: string, method = 'GET', body?: object) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const csrf = await fetch('http://127.0.0.1:5081/api/v1/auth/csrf', {
        credentials: 'include',
      }).then((r) => r.json())
      const response = await fetch(`http://127.0.0.1:5081/api/v1${path}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.data.csrfToken },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      return { status: response.status, body: await response.json() }
    },
    { path, method, body },
  )
}
test('Phase 5 onboarding, settings, reload, switching, themes and isolation use MongoDB', async ({
  page,
  browser,
}) => {
  await authenticated(page)
  const first = await createCompany(page, 'Hans Solar', 'hans-solar')
  await expect(page.getByText('Active workspace memberships')).toBeVisible()
  expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([])
  const second = await createCompany(page, 'Creative Agency', 'creative-agency')
  await page.getByLabel('Current workspace').selectOption(first)
  await expect(
    page.getByRole('heading', { name: 'Hans Solar workspace', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Creative Agency workspace', exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Hans Solar workspace', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Workspace settings', exact: true }).click()
  await page.getByLabel('Workspace name', { exact: true }).fill('Solar Operations')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('status')).toContainText('Settings saved')
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Solar Operations', exact: true })).toBeVisible()
  await page.getByLabel('Current workspace').selectOption(second)
  await expect(
    page.getByRole('heading', { name: 'Creative Agency workspace', exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const outsider = await browser.newContext(),
    other = await outsider.newPage()
  await authenticated(other)
  expect((await tenantRequest(other, `/workspaces/${first}`)).status).toBe(404)
  await other.goto(`/app/w/${first}/overview`)
  await expect(other.getByRole('heading', { name: 'Workspace access unavailable' })).toBeVisible()
  await expect(other.getByText('Solar Operations', { exact: true })).toHaveCount(0)
  await outsider.close()
})
test('Phase 5 new and existing users accept captured invitations, roles update and removal revokes access', async ({
  page,
  browser,
}) => {
  await authenticated(page)
  const workspaceId = await createCompany(page, 'Hans Solar', 'hans-solar')
  const org = (await tenantRequest(page, `/workspaces/${workspaceId}`)).body.data.organization
    .id as string
  const memberContext = await browser.newContext(),
    member = await memberContext.newPage(),
    recipient = email()
  await page.getByRole('link', { name: 'Team', exact: true }).click()
  await page.getByRole('button', { name: 'Invite member' }).click()
  await page.getByLabel('Email address', { exact: true }).fill(recipient)
  await page.getByRole('button', { name: 'Create invitation', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText(recipient, { exact: true })).toBeVisible()
  const link = await capturedLink(recipient, 'invitation')
  await member.goto(link)
  await expect(member.getByRole('link', { name: 'Create an account', exact: true })).toBeVisible()
  await signup(member, recipient)
  await verify(member, recipient)
  await member.goto('/login')
  await member.getByLabel('Work email').fill(recipient)
  await member.getByLabel('Password', { exact: true }).fill(password)
  await member.getByRole('button', { name: 'Sign in', exact: true }).click()
  // Full-page navigation to verification intentionally clears memory; reopen the original invitation.
  await expect(member.getByRole('heading', { name: 'Welcome, Browser Identity.' })).toBeVisible()
  await member.goto(link)
  await member.getByRole('button', { name: 'Accept invitation', exact: true }).click()
  await expect(
    member.getByRole('heading', { name: 'Hans Solar workspace', exact: true }),
  ).toBeVisible()
  await expect(member.getByRole('button', { name: 'Invite member' })).toHaveCount(0)
  await page.reload()
  const row = page
    .getByRole('row')
    .filter({ hasText: recipient })
    .filter({ has: page.getByRole('button', { name: 'Save role' }) })
  await row.getByRole('combobox').selectOption('VIEWER')
  await row.getByRole('button', { name: 'Save role' }).click()
  await expect(page.getByRole('status')).toContainText('Change saved')
  await member.reload()
  await expect(member.getByText('Company role: MEMBER', { exact: true })).toBeVisible()
  expect(
    (
      await tenantRequest(member, `/workspaces/${workspaceId}`, 'PATCH', {
        name: 'Forbidden',
        version: 1,
      })
    ).status,
  ).toBe(403)
  await row.getByRole('button', { name: 'Remove', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Change saved')
  await member.reload()
  await expect(member.getByRole('heading', { name: 'Workspace access unavailable' })).toBeVisible()
  // The already verified member accepts a fresh invitation without re-registration.
  const fresh = await tenantRequest(page, `/organizations/${org}/invitations`, 'POST', {
    email: recipient,
    organizationRole: 'MEMBER',
    targets: [{ workspaceId, role: 'MEMBER' }],
  })
  expect(fresh.status).toBe(201)
  // Use the newest controlled message, without writing its private contents to the report.
  const files = await readdir(
    fileURLToPath(new URL('../../backend/.mail-capture/', import.meta.url)),
  )
  let freshLink = ''
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const message = JSON.parse(
      await readFile(
        fileURLToPath(new URL(`../../backend/.mail-capture/${file}`, import.meta.url)),
        'utf8',
      ),
    )
    if (message.to === recipient && message.purpose === 'invitation' && message.link !== link)
      freshLink = message.link
  }
  expect(Boolean(freshLink)).toBe(true)
  await member.goto(freshLink)
  await member.getByRole('button', { name: 'Accept invitation', exact: true }).click()
  await expect(
    member.getByRole('heading', { name: 'Hans Solar workspace', exact: true }),
  ).toBeVisible()
  await member.goto('/account')
  await member.getByRole('button', { name: 'Sign out', exact: true }).click()
  await member.goto(`/app/w/${workspaceId}/overview`)
  await expect(member.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await memberContext.close()
})

test('Phase 5 invitation dialog is keyboard accessible in light/dark themes and mobile layout', async ({
  page,
}) => {
  await authenticated(page)
  await createCompany(page, 'Accessible Company', 'accessible-company')
  await page.getByRole('link', { name: 'Team', exact: true }).click()
  for (const theme of ['Light', 'Dark']) {
    await page.getByRole('button', { name: 'Change theme' }).click()
    await page.getByRole('menuitem', { name: `${theme} theme` }).click()
    await page.getByRole('button', { name: 'Invite member' }).click()
    await expect(page.getByRole('dialog', { name: 'Invite a teammate' })).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations.map((v) => v.id)).toEqual([])
    await page.getByLabel('Email address', { exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Company role', { exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Invite member' })).toBeFocused()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Invite member' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Change theme' }).click()
  await page.getByRole('menuitem', { name: 'System theme' }).click()
})

async function realProject(
  page: Page,
  ws: string,
  name = 'Solar Delivery',
  slug = 'solar-delivery',
) {
  await page.goto(`/app/w/${ws}/projects`)
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create project' })
  await dialog.getByLabel('Project name', { exact: true }).fill(name)
  await dialog.getByLabel('Project key', { exact: true }).fill(slug)
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('A real isolated project delivery plan.')
  await dialog.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.getByRole('link', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  return page.url().match(/\/projects\/([^/]+)/)![1]!
}
async function realTask(page: Page, title: string, assign = false) {
  await page.getByRole('button', { name: 'Create task', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Create task' })
  await dialog.getByLabel('Task title', { exact: true }).fill(title)
  await dialog.getByLabel('Description', { exact: true }).fill('Persisted task details.')
  if (assign)
    await dialog.getByLabel('Assignee', { exact: true }).selectOption({ label: 'Browser Identity' })
  await dialog.getByRole('button', { name: 'Create task', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible()
}
test('Phase 6 real projects, assignments, tasks, subtasks, comments, dashboard and reload persist', async ({
  page,
}) => {
  test.setTimeout(120000)
  const recipient = await authenticated(page)
  const ws = await createCompany(page, 'Phase Six Company', 'phase-six-company')
  const projectId = await realProject(page, ws)
  await realTask(page, 'Launch delivery', true)
  await page.getByRole('link', { name: 'Launch delivery', exact: true }).click()
  const taskPath = new URL(page.url()).pathname
  await expect(page.getByRole('heading', { name: 'Launch delivery', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit task', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Edit task' })
  await edit.getByLabel('Priority', { exact: true }).selectOption('urgent')
  await edit.getByLabel('Due date', { exact: true }).fill('2026-12-01')
  await edit.getByLabel('Labels (comma separated)').fill('launch, review')
  await edit.getByRole('button', { name: 'Save task', exact: true }).click()
  await expect(edit).toHaveCount(0)
  await page.getByLabel('Add a comment', { exact: true }).fill('<script>Plain text review</script>')
  await page.getByRole('button', { name: 'Post comment', exact: true }).click()
  await expect(page.getByText('<script>Plain text review</script>', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit comment', exact: true }).click()
  await page.getByLabel('Comment text', { exact: true }).fill('Reviewed and ready.')
  await page.getByRole('button', { name: 'Save comment', exact: true }).click()
  await expect(page.getByText('Reviewed and ready.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add subtask', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('Task title', { exact: true })
    .fill('Check launch details')
  await page.getByRole('dialog').getByLabel('Task status', { exact: true }).selectOption('done')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create subtask', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Subtasks - 1 / 1 completed', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByText('Reviewed and ready.', { exact: true })).toBeVisible()
  await expect(page.getByText('comment added', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Back to Solar Delivery', exact: true }).click()
  await realTask(page, 'Second delivery')
  await page.getByRole('button', { name: 'Kanban board', exact: true }).click()
  await page
    .getByLabel('Move Launch delivery to status', { exact: true })
    .selectOption('in_progress')
  await expect(page.getByRole('status').filter({ hasText: 'Task saved' })).toContainText(
    'Task saved in In Progress',
  )
  await page.reload()
  await page.getByRole('button', { name: 'Kanban board', exact: true }).click()
  await expect(page.getByLabel('Move Launch delivery to status', { exact: true })).toHaveValue(
    'in_progress',
  )
  await page.getByLabel('Move Launch delivery to status', { exact: true }).selectOption('done')
  await expect(page.getByRole('status').filter({ hasText: 'Task saved' })).toContainText(
    'Task saved in Done',
  )
  await page.getByRole('link', { name: 'My Tasks', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Launch delivery', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(
    page
      .getByRole('heading', { name: 'Total tasks', exact: true })
      .locator('..')
      .getByText('3', { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('heading', { name: 'Completed tasks', exact: true })
      .locator('..')
      .getByText('2', { exact: true }),
  ).toBeVisible()
  await page.goto('/account')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await login(page, recipient)
  await page.goto(taskPath)
  await expect(page.getByRole('heading', { name: 'Launch delivery', exact: true })).toBeVisible()
  await page.goto(`/app/w/${ws}/projects/${projectId}`)
  await page.getByRole('button', { name: 'Archive project', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Restore project', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create task', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Restore project', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Launch delivery', exact: true })).toBeVisible()
})
test('Phase 6 viewer project grants remain read-only and another workspace is concealed', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000)
  await authenticated(page)
  const ws = await createCompany(page, 'Phase Six Company', 'phase-six-company')
  const p = await realProject(page, ws)
  await realTask(page, 'Protected delivery')
  const org = (await tenantRequest(page, `/workspaces/${ws}`)).body.data.organization.id as string
  const viewerContext = await browser.newContext(),
    viewer = await viewerContext.newPage()
  try {
    const recipient = await authenticated(viewer)
    const invite = await tenantRequest(page, `/organizations/${org}/invitations`, 'POST', {
      email: recipient,
      organizationRole: 'MEMBER',
      targets: [{ workspaceId: ws, role: 'VIEWER' }],
    })
    expect(invite.status).toBe(201)
    await viewer.goto(await capturedLink(recipient, 'invitation'))
    await viewer.getByRole('button', { name: 'Accept invitation', exact: true }).click()
    await expect(
      viewer.getByRole('heading', { name: 'Phase Six Company workspace', exact: true }),
    ).toBeVisible()
    const userId = (await tenantRequest(viewer, '/auth/me')).body.data.user.id as string
    const current = await tenantRequest(page, `/workspaces/${ws}/projects/${p}`)
    expect(
      (
        await tenantRequest(page, `/workspaces/${ws}/projects/${p}/members`, 'POST', {
          userId,
          role: 'VIEWER',
          version: current.body.data.version,
        })
      ).status,
    ).toBe(200)
    await viewer.goto(`/app/w/${ws}/projects/${p}`)
    await expect(viewer.getByRole('heading', { name: 'Solar Delivery', exact: true })).toBeVisible()
    await expect(viewer.getByRole('button', { name: 'Create task', exact: true })).toHaveCount(0)
    await expect(viewer.getByRole('button', { name: 'Edit project', exact: true })).toHaveCount(0)
    expect(
      (
        await tenantRequest(viewer, `/workspaces/${ws}/projects/${p}/tasks`, 'POST', {
          title: 'Forged write',
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(403)
    await viewer.getByRole('button', { name: 'Kanban board', exact: true }).click()
    await expect(
      viewer.getByLabel('Move Protected delivery to status', { exact: true }),
    ).toBeDisabled()
    const secondWs = await createCompany(page, 'Private Agency', 'private-agency')
    const privateProject = await realProject(page, secondWs, 'Private delivery', 'private-delivery')
    expect(
      (await tenantRequest(viewer, `/workspaces/${secondWs}/projects/${privateProject}`)).status,
    ).toBe(404)
    await viewer.goto(`/app/w/${secondWs}/projects/${privateProject}`)
    await expect(
      viewer.getByRole('heading', { name: 'Workspace access unavailable' }),
    ).toBeVisible()
    await expect(viewer.getByText('Private delivery', { exact: true })).toHaveCount(0)
  } finally {
    await viewerContext.close()
  }
})
test('Phase 6 pointer ordering, keyboard alternatives, themes and accessibility use the real board', async ({
  page,
}) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await authenticated(page)
  const ws = await createCompany(page, 'Accessible Delivery', 'accessible-delivery')
  const projectId = await realProject(page, ws)
  await realTask(page, 'First card')
  await realTask(page, 'Second card')
  await page.getByRole('button', { name: 'Kanban board', exact: true }).click()
  const handle = page.getByRole('button', { name: 'Drag First card', exact: true })
  const target = page.getByRole('region', { name: 'In Progress column', exact: true })
  await handle.scrollIntoViewIfNeeded()
  const start = await handle.boundingBox(),
    end = await target.boundingBox()
  if (!start || !end) throw new Error('Expected drag handle and destination bounds.')
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + start.height / 2, { steps: 4 })
  await page.mouse.move(end.x + end.width / 2, end.y + 100, { steps: 15 })
  await page.mouse.up()
  await expect(page.getByLabel('Move First card to status', { exact: true })).toHaveValue(
    'in_progress',
  )
  await page.getByLabel('Move First card to status', { exact: true }).selectOption('todo')
  await expect(page.getByRole('status').filter({ hasText: 'Task saved' })).toContainText(
    'Task saved in Todo',
  )
  await page.getByRole('button', { name: 'Move First card up', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Task saved' })).toContainText(
    'Task saved in Todo',
  )
  await page.reload()
  await page.getByRole('button', { name: 'Kanban board', exact: true }).click()
  await expect(
    page.getByRole('region', { name: 'Todo column', exact: true }).getByRole('link').first(),
  ).toHaveText('First card')
  for (const theme of ['Light', 'Dark']) {
    await page.getByRole('button', { name: 'Change theme' }).click()
    await page.getByRole('menuitem', { name: `${theme} theme` }).click()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations.map((v) => v.id)).toEqual([])
  }
  await page.getByRole('button', { name: 'Create task', exact: true }).click()
  const modal = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(modal.violations.map((v) => v.id)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Create task', exact: true })).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/app/w/${ws}/projects/${projectId}`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
