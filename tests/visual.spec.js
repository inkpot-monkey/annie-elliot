import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
    test('dynamic site snapshot', async ({ page }) => {
        // Step 1: Visit the Homepage
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Step 2: Scrape all unique internal links
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const internalLinks = new Set();

            anchors.forEach(a => {
                const href = a.getAttribute('href');
                // Filter for local links (starting with / or the full domain)
                // and ignore jumplinks (#), mailto:, etc.
                if (href && (href.startsWith('/') || href.startsWith(window.location.origin)) && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                    // Normalize: remove domain if present to keep it relative or consistent
                    const url = new URL(a.href);
                    if (url.origin === window.location.origin) {
                        internalLinks.add(url.pathname);
                    }
                }
            });
            return Array.from(internalLinks);
        });

        console.log(`Found ${links.length} internal pages to test:`, links);

        // Always include homepage explicitly if not found (though it should be)
        // Also add non-linked pages like email success/failure states
        const uniqueLinks = new Set(['/', '/email-success/', '/email-failure/', ...links]);

        // Step 3 & 4: Iterate and Snapshot
        for (const link of uniqueLinks) {
            console.log(`Testing page: ${link}`);
            await page.goto(link);
            await page.waitForLoadState('networkidle');

            // Create a friendly filename from the path
            // e.g., '/' -> 'home', '/about/' -> 'about'
            const name = link === '/' ? 'home' : link.replace(/^\/|\/$/g, '').replace(/\//g, '-');

            await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
        }
    });
});
