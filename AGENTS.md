# AGENTS.md

Constraints for this repo. Everything here shares one property: **break it and
nothing errors** — the build succeeds, the page renders, and the result is wrong.

Orientation, commands and deployment live in [`README.md`](README.md). Design
rationale lives in comments next to the code it explains; this file is only the
traps.

## The site ships no JavaScript

Every built page has a **0-byte JS bundle**. The lightbox, the navigation and the
gallery layout are CSS — `:target`, `:hover`, flexbox. This is the defining
property of the project, not an optimisation.

**Never add client-side JavaScript.** If a change seems to need it, it needs a
different design. Adding a script breaks nothing visible; it just quietly ends
the thing the site is.

## `src/_data/gallery.js` must export only `default`

An Eleventy `_data/*.js` module with any export besides `default` is handed to
templates as the **whole module namespace**. Add a second named export and
`$data.gallery` silently becomes `{ default, packRows }`, rendering
`[object Object]` instead of the gallery.

This is why the row packer is private and is tested through the `fetch` seam in
`tests/unit/gallery.test.js` rather than imported directly. Keep it that way.

## A `_data/*.js` function is called once per build, not once per page

Eleventy calls a function-exported global data file **once for the whole build**
and passes it the config-API global data (`eleventyConfig.addGlobalData()`), not
a page's data cascade. This project registers none, so the argument arrives as
`{ eleventy }` — `page`, `metadata` and `calendar` are all absent.

Anything that varies per page belongs in `eleventyComputed` in a `*.11tydata.js`
file: `src/src.11tydata.js` computes `structuredDataJson` this way, and
`src/index.11tydata.js` the LCP preload.

Get this wrong and every page silently receives the same value. The JSON-LD did
exactly that — Book on all seven pages, Event on none — and nothing failed:
the build was green, the pages rendered, and the schema was wrong everywhere.
`tests/seo.spec.js` "Per-page structured data" is the guard.

## The book cover's image options live in two files and must match

`src/index.11tydata.js` pre-runs `eleventy-img` on the cover to emit an LCP
`<link rel="preload">`. It only lines up with the in-memory cache if its options
match what `src/index.webc` asks for:

| `src/index.webc`                                                  | `src/index.11tydata.js`         |
| ----------------------------------------------------------------- | ------------------------------- |
| `width="400, 640, 800, 1000"` (line 28)                           | `widths: [400, 640, 800, 1000]` |
| `sizes="(min-width: 60rem) min(34rem, 42vw), calc(100vw - 3rem)"` | `LCP_SIZES`                     |

Note the attribute is `width` (singular) in WebC and it **overrides the plugin's
`widths`** in `eleventy.config.js`. Quality and formats must still match the
plugin config.

Get this wrong and you get a second, redundant transcode plus a preload the
browser never uses — a slower page, a green build, and no error anywhere.

## Gallery geometry is duplicated across three layers

These describe the same container and must move together:

| File                        | Values                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `src/_data/gallery.js`      | `PACK_WIDTH = 1160`, `ROW_GAP = 8`, `TARGET_ROW_HEIGHT = 352`                         |
| `src/reviews.webc`          | `--gap: 0.5rem`, and the `1160` / `8` in the thumbnails' `sizes` expression           |
| `tests/gallery.spec.js`     | `PACK_WIDTH = 1160`, `ROW_GAP = 8` — an independent oracle, deliberately not imported |
| `tests/helpers/viewport.js` | `MOSAIC_MIN_WIDTH = 640`, matching the `39.9375rem` CSS tier                          |

Change one and the layout drifts from what the tests assert, or the `sizes`
attribute starts lying to the browser about how wide the image will be.

## Fixtures are two-sided

Adding a gallery photo to the fixtures needs **both**:

1. an entry in `tests/fixtures/drive-files.json`, and
2. a real image in `tests/fixtures/gallery-images/` whose **actual pixel
   dimensions match the `imageMediaMetadata` you declared**.

Declare dimensions that don't match the file and the tests pass on geometry the
real pipeline would never produce.

**The fixture events sit in 2019 and 2099 on purpose.** `calendar.js` partitions
future from past against `new Date()` at build time. Move those dates near the
present and events start migrating between sections as time passes, changing the
page under the visual baselines.

## Image `src` is relative to the working directory, not to `src/`

`src/author.webc` uses `src="assets/images/author.png"` → the repo-root
`assets/`. `src/index.webc` uses `src="src/static/images/book-cover.jpg"`. Both
resolve from the process CWD.

## Never deploy `dist-test/`

It is a **fixture** build — placeholder photos, events dated 2019 and 2099 — that
looks enough like the real site to be mistaken for it. Playwright writes it on
port 8081; `npm run dev` and `npm run build` use `dist/`.

## There is no CI

`npm run test:all` before pushing is the only gate, and pushing to `main`
deploys. Nothing will catch a regression for you.

If the visual baselines fail, **read the diff before updating them**. Running
`npm run test:update` to make red turn green is how a real regression gets
committed as the new expected appearance.
