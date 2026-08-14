# Annie Elliot - Mr & Mrs Charles Dickens

This is the source code for the "Annie Elliot" website, built with Eleventy.

## Managing the photo gallery

The reviews-page photo gallery is sourced from a Google Drive folder the site owner
manages directly (captions and order live in Drive, not in the repo). The
owner-facing guide for adding, captioning, reordering, replacing, and publishing
photos is in [`docs/managing-gallery-photos.md`](docs/managing-gallery-photos.md).

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

#### Fixture data

Two pages are built from live remote data: the reviews gallery reads a Google
Drive folder and the events page reads a Google Calendar. Screenshotting those
directly meant the baselines drifted whenever Annie added a photo or an event —
and the events page drifted on its own regardless, because `calendar.js` splits
future from past against `new Date()` at build time, so an event silently moved
sections as it passed.

Playwright therefore builds with `FIXTURE_DATA=1`, which swaps just the two
`fetch` calls for checked-in files:

| Fixture | Stands in for |
| --- | --- |
| `tests/fixtures/drive-files.json` + `gallery-images/` | the Drive `files.list` response |
| `tests/fixtures/calendar-events.json` | the Calendar `events.list` response |

Only the fetch is swapped. Filename ordering, caption fallback, EXIF-rotation
handling, the justified-row packer, date formatting and the future/past split all
still run for real — the fixture photos carry the same eleven aspect ratios as the
live folder, so they pack into the same 3+2+3+3 rows, and the fixture events sit
in 2019 and 2099 so the partition cannot flip.

The test server runs on **port 8081 with its own `dist-test/` output**, kept
separate from `npm run dev` on 8080 so a live-data build can never be reused for a
screenshot run, and so a fixture build is never left where a deploy might find it.
A consequence worth knowing: the suite no longer needs `GOOGLE_KEY` and runs
offline.

To refresh a fixture, edit the JSON by hand — it is a trimmed copy of the API
response shape. Adding a gallery photo also needs an image in
`tests/fixtures/gallery-images/` whose real dimensions match the
`imageMediaMetadata` you declare, or the packed ratio will disagree with the file.

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
*   **HTML Validation:** `npm run test:html` (run `npm run build` first — it lints `dist/`)
*   **Full Suite:** `npm run test:all`

`html-validate` lints Eleventy's build output rather than hand-written source, so
two of its stock rules are re-tuned in `.htmlvalidate.json`:

*   `doctype-style` is set to `lowercase`. The layout authors `<!DOCTYPE HTML>`,
    but WebC re-serialises it as `<!doctype html>`; both are valid HTML5, and the
    source can't win that argument.
*   `no-trailing-whitespace` is off. Stripping a `webc:if` element leaves its
    indentation behind on an otherwise empty line. Nobody reads `dist/`
    whitespace, and contorting the templates to satisfy the rule would cost more
    than it's worth.

`no-inline-style` stays on, with an allowlist for the CSS custom properties that
components legitimately set per instance (the gallery's `--r` / `--sum`, the nav's
`--font-size` / `--dot-color` / `--margin`). Any other inline style is still an error.

## Reporting

Playwright generates an HTML report after each run, which provides detailed insights, including "diff" views for visual tests and specific violation details for accessibility tests.

## SEO & Indexing

To ensure Google indexes your changes (especially the new "Mrs Dickens" keywords and Event schema) quickly:

1.  **Google Search Console**: Use the "URL Inspection" tool on the homepage and click **Request Indexing**.
2.  **Sitemaps**: Resubmit `sitemap.xml` in the Search Console.
3.  **Verification**: Use "Test Live URL" to confirm that the server-side JSON-LD and meta descriptions are visible to Google's crawler.

For a detailed breakdown of the SEO strategy and implementation, see the `audit_report.md` and `walkthrough.md` in the documentation folder.
