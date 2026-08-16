# annieelliot.co.uk

The website for _Mr & Mrs Charles Dickens: Her Story_, a novel by Annie Elliot.

An [Eleventy](https://www.11ty.dev/) static site templated entirely in
[WebC](https://www.11ty.dev/docs/languages/webc/), deployed to Cloudflare Pages.
Every page ships a **0-byte JavaScript bundle** — the gallery lightbox, the
navigation and the layout are all CSS. Two pages are built from live Google data
at build time: the events page reads a Google Calendar, and the reviews gallery
reads a Google Drive folder.

## Quick start

The development environment is provided by [Nix](https://nixos.org/).

```bash
direnv allow      # or: nix develop
pnpm install
npm run dev       # http://localhost:8080
```

**Install with `pnpm`, not `npm`.** `pnpm-lock.yaml` is the lockfile, and it is
what pins the versions Cloudflare builds with. Running `npm install` writes a
competing `package-lock.json`; Cloudflare picks its package manager from
whichever lockfile it finds, so an accidental one silently changes what
production installs. The `npm run …` scripts are fine — it is only the install
that must be pnpm.

You need a `.env` in the repo root containing a Google API key:

```
GOOGLE_KEY=...
```

One key serves both Drive and Calendar. **A build without it fails immediately** —
`calendar.js` and `gallery.js` both throw rather than render an empty page. The
test suite is the exception: it uses fixtures and needs neither the key nor a
network connection.

**Note for Nix users:** `flake.nix` provides a system-compatible Chromium, sets
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` so Playwright uses it instead of
downloading incompatible binaries, and sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
Outside Nix, Playwright will want to fetch its own browsers.

## How it's built

|             |                                                                           |
| ----------- | ------------------------------------------------------------------------- |
| Input       | `src/` — pages are top-level `.webc` files, one layout in `src/_layouts/` |
| Output      | `dist/`                                                                   |
| Components  | `src/_components/**/*.webc`, globbed by the WebC plugin                   |
| Global data | `src/_data/` — thin wrappers over the modules in `src/_lib/`              |
| Images      | `@11ty/eleventy-img`, at build time, for local **and** remote sources     |

There are no collections. `src/sitemap.njk` uses the implicit `collections.all`.

Data flows in at build time:

- **`src/_data/calendar.js`** — Google Calendar `events.list`. Formats en-GB
  display strings, handles all-day vs timed events, and partitions into
  `futureEvents` / `pastEvents` against `new Date()`.
- **`src/_data/gallery.js`** — Google Drive `files.list` for a public folder.
  Derives captions and ordering from Drive metadata, computes each photo's
  display aspect ratio, and packs the photos into justified rows.
- **`src/_data/reviews.json`** — static, edited in the repo.

Both remote fetches are cached by `eleventy-fetch` in `.cache/`.

Each `_data` module is a `default`-only wrapper — Eleventy insists on that, see
[`AGENTS.md`](AGENTS.md) — over five modules in `src/_lib/`, split along the
line between what Google says and what this site decides:

| Module                    | Holds                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- |
| `_lib/google-auth.js`     | `apiKey()`. An `Auth` is a function from `Request` to authorised `Request`    |
| `_lib/google-drive.js`    | `listFiles` / `normalisePhotos` / `fetchPhotos` — displayed aspect ratios     |
| `_lib/google-calendar.js` | `listEvents` / `normaliseEvents` / `fetchEvents` — ISO strings, never `Date`s |
| `_lib/gallery-layout.js`  | `packRows` / `parseFilename` / `SKIP_MIME` and the packing geometry           |
| `_lib/event-display.js`   | en-GB date strings, and the future/past partition around a given instant      |

The three `google-*` modules read no environment, format nothing and know no
site: the key, the folder and calendar ids, the HEIC skip, the ordering, the
`"Europe/London"` fallback and the empty-folder hard fail all live in
`src/_data/`. They are shaped to be lifted out into a package later — the
reasoning is in `.scratch/google-data-package/` (untracked).

## Testing

Everything runs through [Playwright](https://playwright.dev/) except the unit
tests, which use `node --test`.

| Command               | Covers                                                                |
| --------------------- | --------------------------------------------------------------------- |
| `npm run test:unit`   | `src/_lib/` directly, and the two `src/_data/` wrappers — see below   |
| `npm run test:visual` | **The whole Playwright suite** — visual, a11y, SEO, gallery, lightbox |
| `npm run test:seo`    | Title, description, Open Graph, canonical, JSON-LD                    |
| `npm run test:a11y`   | `axe` against WCAG 2 A/AA over seven pages                            |
| `npm run test:html`   | `html-validate` over `dist/` — **run `npm run build` first**          |
| `npm run test:all`    | `test:unit` → `test:seo` → `test:html`                                |
| `npm run test:update` | Rewrite the visual baselines after an intentional design change       |
| `npm run report`      | Open the Playwright HTML report, including visual diffs               |

`npm run test:visual` is named for its most expensive job but is literally
`npx playwright test`, so it runs every spec in `tests/`.

No unit suite needs `GOOGLE_KEY` or a network. The pure modules —
`gallery-layout`, `event-display`, and the `normalise*` half of each transport —
are called directly; the transports take their `fetch` as an option; and the two
`_data` wrappers, which fix the transport to the global `fetch`, still stub it.

| Suite                                | Covers                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `tests/unit/gallery-layout.test.js`  | Filename parsing, the skip list, and the row packer                                |
| `tests/unit/event-display.test.js`   | en-GB formatting and the partition, against an injected clock                      |
| `tests/unit/google-drive.test.js`    | Displayed aspect ratios, the caption guarantee, the `files.list` query             |
| `tests/unit/google-calendar.test.js` | Recurrence expansion, the page walk, the inclusive all-day end                     |
| `tests/unit/google-auth.test.js`     | The key reaches the request, and nothing else changes                              |
| `tests/unit/gallery.test.js`         | The site's ordering, caption refinement, HEIC skip, empty-folder fail, image `src` |
| `tests/unit/calendar.test.js`        | The site's sort, its `"Europe/London"` fallback, and the fixture path              |

> **Run `npm run test:all` before you push.** There is no CI — this is the gate.

### Fixture data

Two pages are built from live remote data: the reviews gallery reads a Google
Drive folder and the events page reads a Google Calendar. Screenshotting those
directly meant the baselines drifted whenever Annie added a photo or an event —
and the events page drifted on its own regardless, because `calendar.js` splits
future from past against `new Date()` at build time, so an event silently moved
sections as it passed.

Playwright therefore builds with `FIXTURE_DATA=1`, which swaps just the two
`fetch` calls for checked-in files:

| Fixture                                               | Stands in for                       |
| ----------------------------------------------------- | ----------------------------------- |
| `tests/fixtures/drive-files.json` + `gallery-images/` | the Drive `files.list` response     |
| `tests/fixtures/calendar-events.json`                 | the Calendar `events.list` response |

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

### HTML validation

`html-validate` lints Eleventy's build output rather than hand-written source, so
two of its stock rules are re-tuned in `.htmlvalidate.json`:

- `doctype-style` is set to `lowercase`. The layout authors `<!DOCTYPE HTML>`,
  but WebC re-serialises it as `<!doctype html>`; both are valid HTML5, and the
  source can't win that argument.
- `no-trailing-whitespace` is off. Stripping a `webc:if` element leaves its
  indentation behind on an otherwise empty line. Nobody reads `dist/`
  whitespace, and contorting the templates to satisfy the rule would cost more
  than it's worth.

`no-inline-style` stays on, with an allowlist for the CSS custom properties that
components legitimately set per instance (the gallery's `--r` / `--sum`, the nav's
`--font-size` / `--dot-color` / `--margin`). Any other inline style is still an error.

### Occasional checks

These two run against `npm run dev` on port 8080, so they need it running in
another terminal. They aren't part of the pre-push gate.

```bash
npm run test:lighthouse   # accessibility + SEO, writes lighthouse-report.html
npm run test:links        # internal broken-link crawl
```

`npm run debug` re-runs the build with `DEBUG=Eleventy*` when a template is
behaving strangely.

## Deploying

The site is a **Cloudflare Pages** project (`annie-elliot`) building from the
`main` branch. Pushing to `main` builds and publishes on its own. The build
command and `GOOGLE_KEY` live in the Cloudflare dashboard, not in this repo.

Because the events and gallery pages read live Google data **at build time**, a
change made in Calendar or Drive does not appear until the site is rebuilt.
`workers/calendar` exists to solve exactly that: a daily cron that pokes a Pages
deploy hook so those changes surface without anyone doing anything. Waiting up to
24 hours is usually fine; when it isn't, retry the deployment from the dashboard.

Never deploy `dist-test/`. It is a fixture build that looks like the real site.

### Getting changes indexed

After a change that matters for search — new copy, new Event schema, a changed
description:

1. **Google Search Console** → **URL Inspection** on the affected page →
   **Request Indexing**.
2. Resubmit `sitemap.xml` under **Sitemaps**.
3. Use **Test Live URL** to confirm the server-rendered JSON-LD and meta
   description are visible to the crawler.

## Related

- [`AGENTS.md`](AGENTS.md) — the constraints that break this project silently.
  Read it before changing the gallery, the fixtures or the image pipeline.
- [`workers/contact/`](workers/contact/) — the contact form's mail worker.
- [`workers/calendar/`](workers/calendar/) — the daily rebuild cron.
- [`docs/managing-gallery-photos.md`](docs/managing-gallery-photos.md) — written
  for Annie: adding, captioning and reordering gallery photos in Drive.
- [`docs/adding-events.md`](docs/adding-events.md) — written for Annie: adding
  book events to the calendar.
