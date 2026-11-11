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

async function capturedLink(recipient: string, purpose: 'verify-email' | 'reset-password') {
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
