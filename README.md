# Annie Elliot - Mr & Mrs Charles Dickens

This is the source code for the "Annie Elliot" website, built with Eleventy.

## Development

This project uses [Nix](https://nixos.org/) for a reproducible development environment.

```bash
# Enter the development environment
direnv allow
# OR
nix develop

# Start the dev server
npm run dev
```

**Note for Nix Users:**
The development environment (`flake.nix`) is configured to:
1.  Provide a system-compatible Chromium binary.
2.  Automatically set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` so Playwright uses it instead of downloading incompatible binaries.
3.  Set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` to speed up installation.

## Testing

This project maintains a robust testing suite using [Playwright](https://playwright.dev/) to ensure visual consistency and accessibility standards.

### 1. Visual Regression Testing

We use visual regression testing to catch unintended visual changes across the site. The tests crawl the website, identify all internal pages, and compare their current appearance against a set of "golden" baseline snapshots.

*   **Command:** `npm run test:visual`
*   **What it does:**
    *   Starts the local development server.
    *   Visits the homepage and dynamically finds all internal links (including `/email-success/` and `/email-failure/`).
    *   Captures a full-page screenshot of each page.
    *   Compares it pixel-by-pixel with the baseline.
*   **Updating Snapshots:** If you make intentional design changes, the tests will fail. To update the baselines to match your new design, run:
    ```bash
    npm run test:update
    ```

### 2. Accessibility Testing

We use `@axe-core/playwright` to ensure the website is accessible to all users and complies with WCAG standards (A, AA).

*   **Command:** `npm run test:a11y`
*   **What it does:**
    *   Starts the local development server.
    *   Navigates to key pages (`/`, `/author/`, `/events/`, `/contact/`, etc.).
    *   Runs the `axe` accessibility engine on each page.
    *   Checks for violations such as low color contrast, missing labels, or structural issues.

### 3. Other Tests

*   **SEO Checks:** `npm run test:seo`
*   **HTML Validation:** `npm run test:html`
*   **Full Suite:** `npm run test:all`

## Reporting

Playwright generates an HTML report after each run, which provides detailed insights, including "diff" views for visual tests and specific violation details for accessibility tests.

## SEO & Indexing

To ensure Google indexes your changes (especially the new "Mrs Dickens" keywords and Event schema) quickly:

1.  **Google Search Console**: Use the "URL Inspection" tool on the homepage and click **Request Indexing**.
2.  **Sitemaps**: Resubmit `sitemap.xml` in the Search Console.
3.  **Verification**: Use "Test Live URL" to confirm that the server-side JSON-LD and meta descriptions are visible to Google's crawler.

For a detailed breakdown of the SEO strategy and implementation, see the `audit_report.md` and `walkthrough.md` in the documentation folder.
