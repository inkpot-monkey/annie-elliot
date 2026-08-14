// The reviews gallery has one structural breakpoint, and two specs need it.
//
// Below 40rem the gallery is a single full-width column with the caption printed
// under each photo, and the lightbox is suppressed entirely. At 40rem and above
// it is a justified mosaic whose rows must add up, and the lightbox works.
//
// The CSS tier is `max-width: 39.9375rem` — one pixel short of 40rem, so it
// cannot overlap the `(min-width: 40rem)` clause in the thumbnails' `sizes`.
// That makes "narrow" exactly `width < 640`, which is what this guard tests.
export const MOSAIC_MIN_WIDTH = 640;

/** True when this project's viewport is in the single-column tier. */
export const isNarrow = (testInfo) =>
	(testInfo.project.use.viewport?.width ?? 0) < MOSAIC_MIN_WIDTH;
