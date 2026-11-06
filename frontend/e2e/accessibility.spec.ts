import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'

for (const theme of ['dark', 'light']) {
  for (const route of [
    '/',
    '/login',
    '/w/studio/dashboard',
    '/w/studio/projects',
    '/w/studio/settings',
    '/w/studio/portal/dashboard',
  ]) {
    test(`${theme} accessibility scan ${route}`, async ({ page }) => {
      await page.addInitScript(
        (value) =>
          localStorage.setItem(
            'flowwork-ui',
            JSON.stringify({ state: { theme: value, collapsed: false }, version: 0 }),
          ),
        theme,
      )
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(results.violations).toEqual([])
    })
  }
}
