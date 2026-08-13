import { test, expect } from '@playwright/test';

import { isNarrow } from './helpers/viewport.js';

// The lightbox is pure CSS/HTML (no JavaScript): each `#photo-N` overlay is
// revealed by `:target` when its hash is active, and prev/next/close are plain
// anchors. Everything below is derived from the rendered thumbnails, so the suite
// stays green regardless of how many photos are in Annie's Drive folder.
//
// It is also suppressed below 40rem: under that width the gallery is a single
// full-width column with the caption printed below each photo, so the overlay
// showed the same photo at the same width. Every test that opens an overlay
// therefore runs only where one exists; the Mobile project (Pixel 5, 393px) is
// covered instead by the "no lightbox on a phone" test at the bottom.

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

    test('an overlay stays hidden until its thumbnail is activated', async ({ page }, testInfo) => {
        test.skip(isNarrow(testInfo), 'the lightbox is suppressed below 40rem');
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

    test('prev / next navigate with wrap-around', async ({ page }, testInfo) => {
        test.skip(isNarrow(testInfo), 'the lightbox is suppressed below 40rem');
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

    test('the open overlay matches its snapshot', async ({ page }, testInfo) => {
        test.skip(isNarrow(testInfo), 'the lightbox is suppressed below 40rem');
        // Visual guard for the lightbox layout: the photo must fit the viewport
        // (no clipped edge) and the prev/next arrows sit centred where the CSS
        // puts them.
        // The overlay is slightly translucent, so the gallery thumbnails behind it
        // stay faintly visible. Force every image eager and wait for them all to
        // finish first, otherwise a thumbnail streaming in mid-capture keeps the
        // two stabilisation frames from matching.
        await page.evaluate(() =>
            Promise.all(
                Array.from(document.images).map((img) => {
                    img.loading = 'eager';
                    return img.complete
                        ? Promise.resolve()
                        : new Promise((res) => {
                              img.onload = img.onerror = res;
                          });
                }),
            ),
        );

        await page.locator('.photo-gallery .thumb').first().click();
        const overlay = page.locator('#photo-0');
        await expect(overlay).toBeVisible();

        // Wait for the eager lightbox image to actually decode, so the shot isn't
        // taken over an empty (pulsing) frame.
        const img = overlay.locator('.lb-stage img');
        await img.evaluate(
            (el) =>
                el.complete && el.naturalWidth
                    ? null
                    : new Promise((res) => {
                          el.addEventListener('load', res, { once: true });
                          el.addEventListener('error', res, { once: true });
                      }),
        );

        // Viewport shot (the overlay is position:fixed, so it fills the viewport).
        await expect(page).toHaveScreenshot('lightbox-open.png', { timeout: 15000 });
    });

    test('the close control dismisses the lightbox', async ({ page }, testInfo) => {
        test.skip(isNarrow(testInfo), 'the lightbox is suppressed below 40rem');
        const thumbs = page.locator('.photo-gallery .thumb');
        const overlay = page.locator('#photo-0');

        await thumbs.first().click();
        await expect(overlay).toBeVisible();
        await overlay.locator('.lb-close').click();
        await expect(overlay).toBeHidden();
    });

    test('a backdrop click closes the lightbox', async ({ page }, testInfo) => {
        test.skip(isNarrow(testInfo), 'the lightbox is suppressed below 40rem');
        const thumbs = page.locator('.photo-gallery .thumb');
        const overlay = page.locator('#photo-0');

        await thumbs.first().click();
        await expect(overlay).toBeVisible();
        // The backdrop fills the viewport behind the centred frame; click a
        // top-left corner that is clear of the frame and the fixed controls.
        await overlay.locator('.lb-backdrop').click({ position: { x: 5, y: 5 } });
        await expect(overlay).toBeHidden();
    });

    test('a phone gets no lightbox at all', async ({ page }, testInfo) => {
        test.skip(!isNarrow(testInfo), 'this is the sub-40rem behaviour');

        // The markup is identical at every width — the site is JavaScript-free,
        // so one HTML file serves every viewport and CSS alone decides this.
        await expect(page.locator('.lightbox').first()).toBeHidden();

        // The thumbnail is inert, so a tap cannot push a dead #photo-N onto the
        // history stack. force:true because pointer-events:none is the mechanism.
        const before = page.url();
        await page.locator('.photo-gallery .thumb').first().click({ force: true });
        await expect(page.locator('#photo-0')).toBeHidden();
        expect(page.url()).toBe(before);
    });
});
