import { test, expect } from '@playwright/test';

test.describe('SEO Checks', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should have correct title', async ({ page }) => {
        await expect(page).toHaveTitle('Mr & Mrs Charles Dickens: Her Story | A Novel by Annie Elliot');
    });

    test('should have correct meta description', async ({ page }) => {
        const metaDescription = page.locator('meta[name="description"]');
        await expect(metaDescription).toHaveAttribute('content', "Discover the untold story of Mrs Dickens. Annie Elliot's historical novel reveals the life of Catherine Dickens, the woman behind the famous author.");
    });

    test('should have viewport meta tag', async ({ page }) => {
        const viewport = page.locator('meta[name="viewport"]');
        await expect(viewport).toHaveCount(1);
    });

    test('should have correct Open Graph tags', async ({ page }) => {
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Mr & Mrs Charles Dickens: Her Story | A Novel by Annie Elliot');

        await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', "Discover the untold story of Mrs Dickens. Annie Elliot's historical novel reveals the life of Catherine Dickens, the woman behind the famous author.");

        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://annieelliot.co.uk/images/book-cover.jpg');

        // Check fuzzy match for URL since it might vary locally vs production canonical
        // But the layout code uses metadata.canonical OR constructed URL.
        // Let's check if the tag exists and has a value similar to expected.
        const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
        expect(ogUrl).toContain('annieelliot.co.uk');
    });

    test('should include Book JSON-LD schema', async ({ page }) => {
        const ldJsonScripts = await page.$$eval('script[type="application/ld+json"]', scripts =>
            scripts.map(s => {
                try {
                    return JSON.parse(s.innerText);
                } catch (e) {
                    return null;
                }
            }).filter(s => s !== null)
        );

        // Handle array of schemas or single objects, flatten them
        const schemas = ldJsonScripts.flat();
        const bookSchema = schemas.find(s => s['@type'] === 'Book');

        expect(bookSchema).toBeDefined();
        expect(bookSchema.name).toBe('Mr & Mrs Charles Dickens: Her Story');
        expect(bookSchema.author.name).toBe('Annie Elliot');
        expect(bookSchema.workExample.isbn).toBe('978-1784650961');
        expect(bookSchema.image).toContain('/images/book-cover.jpg');
    });

    test('should have semantic review markup', async ({ page }) => {
        const reviewsSection = page.locator('#reviews');

        // Only run if reviews section is present (it is on homepage)
        if (await reviewsSection.count() > 0) {
            // Check for figure, blockquote, figcaption
            await expect(reviewsSection.locator('figure.review-card').first()).toBeVisible();
            await expect(reviewsSection.locator('blockquote.quote').first()).toBeVisible();
            await expect(reviewsSection.locator('figcaption.reviewer').first()).toBeVisible();

            // Check for correct heading level
            await expect(reviewsSection.locator('h3')).toBeVisible();
            await expect(reviewsSection.locator('h3')).toHaveText('Reviews');
        }
    });
});
