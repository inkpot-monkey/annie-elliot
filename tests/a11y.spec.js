import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
    const pages = [
        { url: '/', name: 'Home' },
        { url: '/author/', name: 'Author' },
        { url: '/events/', name: 'Events' },
        { url: '/reviews/', name: 'Reviews' },
        { url: '/contact/', name: 'Contact' },
        { url: '/email-success/', name: 'Email Success' },
        { url: '/email-failure/', name: 'Email Failure' },
    ];

    for (const pageInfo of pages) {
        test(`should pass accessibility checks on ${pageInfo.name} page`, async ({ page }) => {
            await page.goto(pageInfo.url);

            const accessibilityScanResults = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                .analyze();

            expect(accessibilityScanResults.violations).toEqual([]);
        });
    }
});
