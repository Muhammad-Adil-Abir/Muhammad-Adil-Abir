import { expect, test, type Page } from '@playwright/test';
import { syntheticSnapshot, FIXTURE_USER } from '../tests/fixtures/synthetic';

/**
 * Archive tests serve clearly-labelled TEST FIXTURE data through request interception,
 * so they check exact numbers without depending on (or misrepresenting) live data.
 */
const fixture = syntheticSnapshot();

async function useFixture(page: Page, body: unknown = fixture, status = 200) {
  await page.route('**/data/github.json', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) }),
  );
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test.describe('The Arrival', () => {
  test('intro is skippable, remembered for the session, and never blocks content', async ({ page }, info) => {
    test.skip(info.project.name === 'reduced-motion', 'covered by the reduced-motion test');
    const errors = trackErrors(page);
    await useFixture(page);
    await page.goto('/');
    const skip = page.getByRole('button', { name: /skip intro/i });
    await expect(skip).toBeVisible();
    // Content below is already in the DOM and reachable while the intro plays.
    await expect(page.locator('#manifesto')).toBeAttached();
    await skip.click();
    await expect(skip).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toContainText("Abir's World.");
    await expect(page.getByRole('link', { name: /enter the world/i })).toBeFocused();
    expect(await page.evaluate(() => sessionStorage.getItem('aether:arrival-seen'))).toBe('1');
    await page.reload();
    await expect(page.getByRole('button', { name: /skip intro/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /replay arrival/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Escape skips the intro', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await useFixture(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /skip intro/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /skip intro/i })).toBeHidden();
  });

  test('the full welcome message and tagline are present', async ({ page }) => {
    await useFixture(page);
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('Welcome to');
    await expect(h1).toContainText("Abir's World.");
    await expect(page.getByText('A world built on curiosity, code, and possibility.')).toBeAttached();
    await expect(page.getByText('Some people launch missiles. I launch ideas.')).toBeAttached();
    // Regression: "WORLD." must never wrap or clip its final letter on any viewport.
    const skip = page.getByRole('button', { name: /skip intro/i });
    if (await skip.isVisible()) await skip.click();
    const chars = page.locator('.arrival__word').nth(1).locator('.ch');
    const [first, last] = [await chars.first().boundingBox(), await chars.last().boundingBox()];
    expect(first && last).toBeTruthy();
    expect(Math.abs(first!.y - last!.y)).toBeLessThan(2);
    expect(last!.x + last!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  });

  test('audio is never created without a click', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __audioContexts: number; AudioContext: typeof AudioContext };
      w.__audioContexts = 0;
      const Original = w.AudioContext;
      w.AudioContext = class extends Original {
        constructor(...a: ConstructorParameters<typeof AudioContext>) {
          super(...a);
          w.__audioContexts++;
        }
      };
    });
    await useFixture(page);
    await page.goto('/');
    await page.waitForTimeout(2500);
    expect(await page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts)).toBe(0);
    const toggle = page.getByRole('button', { name: /sound off/i }).first();
    if (await toggle.isVisible()) await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});

test.describe('Navigation & accessibility', () => {
  test('skip link moves keyboard users straight to the content', async ({ page }) => {
    await useFixture(page);
    await page.goto('/');
    await page.keyboard.press('Tab');
    const link = page.getByRole('link', { name: 'Skip to content' });
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#manifesto$/);
    await expect(page.locator('#manifesto')).toBeInViewport();
  });

  test('chapters are reachable from the navigation', async ({ page }, info) => {
    await useFixture(page);
    await page.goto('/');
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.locator('#nav-sheet').getByRole('link', { name: /archive/i }).click();
    } else {
      await page.getByRole('navigation', { name: 'Chapters' }).first().getByRole('link', { name: /archive/i }).click();
    }
    await expect(page.locator('#archive')).toBeInViewport();
  });

  test('every chapter has a heading and landmarks are present', async ({ page }) => {
    await useFixture(page);
    await page.goto('/');
    await expect(page.locator('main')).toHaveCount(1);
    for (const id of ['arrival-title', 'manifesto-title', 'work-title', 'archive-title', 'contact-title', 'protocol-title']) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
  });
});

test.describe('The Launch Archive', () => {
  const cal = fixture.calendars[0]!;
  const total = cal.days.reduce((s, d) => s + d.count, 0);
  const active = cal.days.filter((d) => d.count > 0).length;

  test('renders exact numbers and one cell per real day', async ({ page }) => {
    await useFixture(page);
    await page.goto('/#archive');
    const archive = page.locator('#archive');
    await expect(archive.getByText(`@${FIXTURE_USER}`)).toBeVisible();
    await expect(archive.locator('.archive__stat').first()).toContainText(total.toLocaleString('en-US'));
    await expect(archive.locator('.archive__stat').nth(1)).toContainText(String(active));
    await expect(archive.getByRole('gridcell')).toHaveCount(cal.days.length);
    // Spot-check that labels carry the real date and count.
    const lastDay = cal.days[cal.days.length - 1]!;
    const label = await archive.getByRole('gridcell').last().getAttribute('aria-label');
    // DOM order is by weekday row, so find the cell by its label instead of position.
    const expected = lastDay.count === 0 ? 'No contributions' : `${lastDay.count} contribution`;
    await expect(archive.locator(`[aria-label*="${expected}"][aria-label*="21 November 2026"]`)).toHaveCount(1);
    expect(label).toBeTruthy();
  });

  test('hover shows the date and count; click opens the launch log', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'touch covered below');
    await useFixture(page);
    await page.goto('/#archive');
    const peak = cal.days.reduce((a, b) => (b.count > a.count ? b : a));
    const cell = page.locator(`[role="gridcell"][aria-label^="${peak.count} contributions on"]`).first();
    await cell.scrollIntoViewIfNeeded();
    await cell.hover();
    await expect(page.locator('.archive__tip')).toContainText(`${peak.count} contributions`);
    await cell.click();
    const detail = page.locator('.archive__detail');
    await expect(detail).toContainText(String(peak.count));
    await expect(detail.getByRole('link', { name: /open this day on github/i })).toHaveAttribute('href', new RegExp(`from=\\d{4}-\\d{2}-\\d{2}`));
  });

  test('keyboard: arrows move by day and week, Enter opens the day', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile');
    await useFixture(page);
    await page.goto('/#archive');
    const focused = page.locator('[role="gridcell"][tabindex="0"]');
    await focused.focus();
    const before = await focused.getAttribute('data-i');
    await page.keyboard.press('ArrowLeft');
    const after = await page.locator('[role="gridcell"][tabindex="0"]').getAttribute('data-i');
    expect(Number(before) - Number(after)).toBe(7);
    await page.keyboard.press('ArrowUp');
    expect(Number(await page.locator('[role="gridcell"][tabindex="0"]').getAttribute('data-i'))).toBe(Number(after) - 1);
    await page.keyboard.press('Enter');
    await expect(page.locator('.archive__detail-count')).toBeVisible();
  });

  test('switching period changes the data', async ({ page }) => {
    await useFixture(page);
    await page.goto('/#archive');
    await page.getByRole('button', { name: '2025', exact: true }).click();
    const y = fixture.calendars[1]!;
    await expect(page.locator('.archive__stat').first()).toContainText(y.days.reduce((s, d) => s + d.count, 0).toLocaleString('en-US'));
  });

  test('mobile: the field scrolls horizontally and opens on the latest weeks', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile');
    await useFixture(page);
    await page.goto('/#archive');
    const scroller = page.locator('.archive__scroller');
    await scroller.scrollIntoViewIfNeeded();
    const m = await scroller.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, sl: el.scrollLeft }));
    expect(m.sw).toBeGreaterThan(m.cw);
    expect(m.sl).toBeGreaterThan(m.sw - m.cw - 4);
    const cell = page.locator('[role="gridcell"][aria-label^="1 contribution"]').last();
    await cell.tap();
    await expect(page.locator('.archive__detail-count')).toBeVisible();
  });

  test('shows an honest offline state when data is unavailable', async ({ page }) => {
    await useFixture(page, 'not found', 404);
    await page.goto('/#archive');
    await expect(page.getByText('Telemetry offline')).toBeVisible();
    await expect(page.getByRole('gridcell')).toHaveCount(0);
    await expect(page.getByText('Manifest syncing')).toBeVisible();
  });

  test('rejects corrupt data without inventing activity', async ({ page }) => {
    await useFixture(page, '{"schema":1,"username":"x","calendars":[{"id":"a","label":"A","days":[{"date":"bad","count":3,"level":1}]}]}');
    await page.goto('/#archive');
    await expect(page.getByText('Telemetry offline')).toBeVisible();
  });
});

test.describe('Selected work', () => {
  test('lists synced repositories with working links, excluding the profile repo', async ({ page }) => {
    const snap = syntheticSnapshot();
    snap.repositories.push({ ...snap.repositories[1]!, name: FIXTURE_USER, url: `https://github.com/${FIXTURE_USER}/${FIXTURE_USER}` });
    await useFixture(page, snap);
    await page.goto('/#work');
    const work = page.locator('#work');
    await expect(work.getByRole('link', { name: /fixture orbital dashboard/i })).toHaveAttribute('href', snap.repositories[0]!.url);
    await expect(work.getByRole('link', { name: /live site/i })).toHaveAttribute('href', 'https://example.com');
    await expect(work.locator('.project')).toHaveCount(2);
  });
});

test.describe('The Final Protocol', () => {
  test('plays, shows the final message, and restarts the journey at the top', async ({ page }, info) => {
    test.slow();
    const errors = trackErrors(page);
    await useFixture(page);
    await page.goto('/');
    if (info.project.name !== 'reduced-motion') await page.getByRole('button', { name: /skip intro/i }).click();
    await page.locator('#protocol').scrollIntoViewIfNeeded();
    const protocol = page.locator('#protocol');
    if (info.project.name !== 'reduced-motion') {
      await expect(protocol.locator('.finale__hud')).toContainText(/Protocol engaged|Protocol complete/, { timeout: 20_000 });
      const skip = protocol.getByRole('button', { name: /^skip/i });
      if (await skip.isVisible()) await skip.click();
    }
    await expect(protocol.locator('.finale__hud')).toContainText('Protocol complete', { timeout: 20_000 });
    for (const text of ['Every ending is a new beginning.', 'The work is never done.', '— Adil Akhtab Abir', 'Thank you for stepping into my world.']) {
      await expect(protocol.getByText(text, { exact: true }).first()).toBeAttached();
    }
    await expect(protocol.locator('.finale__coda')).toBeVisible();
    await protocol.getByRole('button', { name: /restart the journey/i }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeLessThan(5);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    // The full intro is not forced again.
    await expect(page.getByRole('button', { name: /skip intro/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('Reduced motion', () => {
  test('no WebGL, no sequences, everything readable immediately', async ({ page }, info) => {
    test.skip(info.project.name !== 'reduced-motion');
    await useFixture(page);
    await page.goto('/');
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /skip/i })).toHaveCount(0);
    await expect(page.locator('.arrival__poster')).toBeAttached();
    await page.locator('#protocol').scrollIntoViewIfNeeded();
    await expect(page.locator('.finale__coda')).toBeVisible();
    await expect(page.locator('.finale__coda')).toHaveCSS('opacity', '1');
  });

  test('the motion toggle switches the cinematic layer off and on', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop');
    await useFixture(page);
    await page.goto('/');
    await page.getByRole('button', { name: /skip intro/i }).click();
    await expect(page.locator('#arrival canvas')).toHaveCount(1, { timeout: 20_000 });
    await page.getByRole('button', { name: /reduce motion/i }).first().click();
    await expect(page.locator('#arrival canvas')).toHaveCount(0);
    await page.getByRole('button', { name: /reduce motion/i }).first().click();
    await expect(page.locator('#arrival canvas')).toHaveCount(1, { timeout: 20_000 });
  });
});
