import { getStructuredData } from "./structuredData.js";

/**
 * KNOWN BROKEN — produces the same JSON-LD for every page. Do not trust it.
 *
 * A global data file in `_data/` is not what it looks like. Eleventy calls this
 * ONCE for the whole build, and the argument is the config-API global data
 * (`eleventyConfig.addGlobalData()`), not the per-page data cascade. This
 * project registers none, so `data` arrives as `{ eleventy }` and `page`,
 * `metadata` and `calendar` are all empty — verified by instrumenting the build.
 *
 * With an empty `page`, `getStructuredData` reads `page.url` as "" and settles
 * on pageType "book", so every page in the site gets a byte-identical block:
 *   - the Book schema appears on all seven pages instead of only the home page,
 *   - the events page never gets Event schema at all,
 *   - `metadata.description` never reaches the WebSite schema, which falls back
 *     to the package.json description.
 *
 * The fix is per-page computation — `eleventyComputed` in `src/src.11tydata.js`,
 * the pattern `src/index.11tydata.js` already uses for the LCP preload. Moving
 * it there does correct the Book-on-every-page half. It does NOT restore the
 * Event schema: something further along still drops it even when pageType is
 * "events" and calendar.futureEvents is populated. That part is unsolved.
 */
export default async function () {
	return await getStructuredData({}, {}, {});
}
