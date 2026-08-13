// The reviews gallery has one structural breakpoint, and two specs need it.
//
// Below 40rem the gallery is a single full-width column with the caption printed
// under each photo, and the lightbox is suppressed entirely. Above it the gallery
// is a justified mosaic whose rows must add up, and the lightbox works. 40rem is
// 640px at the site's root font size.
export const MOSAIC_MIN_WIDTH = 640;

/** True when this project's viewport is in the single-column tier. */
export const isNarrow = (testInfo) =>
    (testInfo.project.use.viewport?.width ?? 0) < MOSAIC_MIN_WIDTH;
