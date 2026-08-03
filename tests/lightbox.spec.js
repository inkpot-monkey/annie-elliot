import { test, expect } from '@playwright/test';

// The lightbox is pure CSS/HTML (no JavaScript): each `#photo-N` overlay is
// revealed by `:target` when its hash is active, and prev/next/close are plain
// anchors. Everything below is derived from the rendered thumbnails, so the suite
// stays green regardless of how many photos are in Annie's Drive folder.
test.describe('Reviews gallery lightbox (CSS-only :target)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/reviews/');
    });

    test('renders one thumbnail link per photo', async ({ page }) => {
        const thumbs = page.locator('.photo-gallery .thumb');
        await expect(thumbs.first()).toBeVisible();
        // Thumbnails are anchors (#photo-N) — no JavaScript needed to open.
        const tags = await thumbs.evaluateAll((els) => els.map((el) => el.tagName));
        expect(tags.every((t) => t === 'A')).toBe(true);
    });

    test('an overlay stays hidden until its thumbnail is activated', async ({ page }) => {
        const thumbs = page.locator('.photo-gallery .thumb');
        const n = await thumbs.count();
        const first = page.locator('#photo-0');

        await expect(first).toBeHidden();
        await thumbs.first().click();
        await expect(first).toBeVisible();
        await expect(first.locator('.lb-count')).toHaveText(`1 / ${n}`);
        // The overlay shows a real (non-placeholder) image source.
        const src = await first.locator('.lb-stage img').getAttribute('src');
        expect(src).toBeTruthy();
    });

    test('prev / next navigate with wrap-around', async ({ page }) => {
        const thumbs = page.locator('.photo-gallery .thumb');
        const n = await thumbs.count();

        await thumbs.first().click();
        await expect(page.locator('#photo-0')).toBeVisible();

        // Next advances to the second photo.
        await page.locator('#photo-0 .lb-next').click();
        await expect(page.locator('#photo-0')).toBeHidden();
        await expect(page.locator('#photo-1')).toBeVisible();
        await expect(page.locator('#photo-1 .lb-count')).toHaveText(`2 / ${n}`);

        // Prev from the first photo wraps to the last.
        await page.locator('#photo-1 .lb-prev').click();
        await expect(page.locator('#photo-0')).toBeVisible();
        await page.locator('#photo-0 .lb-prev').click();
        await expect(page.locator(`#photo-${n - 1}`)).toBeVisible();
        await expect(page.locator(`#photo-${n - 1} .lb-count`)).toHaveText(`${n} / ${n}`);

        // Next from the last photo wraps to the first.
        await page.locator(`#photo-${n - 1} .lb-next`).click();
        await expect(page.locator('#photo-0')).toBeVisible();
    });

    test('the close control dismisses the lightbox', async ({ page }) => {
        const thumbs = page.locator('.photo-gallery .thumb');
        const overlay = page.locator('#photo-0');

        await thumbs.first().click();
        await expect(overlay).toBeVisible();
        await overlay.locator('.lb-close').click();
        await expect(overlay).toBeHidden();
    });

    test('a backdrop click closes the lightbox', async ({ page }) => {
        const thumbs = page.locator('.photo-gallery .thumb');
        const overlay = page.locator('#photo-0');

        await thumbs.first().click();
        await expect(overlay).toBeVisible();
        // The backdrop fills the viewport behind the centred frame; click a
        // top-left corner that is clear of the frame and the fixed controls.
        await overlay.locator('.lb-backdrop').click({ position: { x: 5, y: 5 } });
        await expect(overlay).toBeHidden();
    });
});
