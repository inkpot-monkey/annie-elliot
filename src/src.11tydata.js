import { getStructuredData } from "./_data/structuredData.js";

export default {
	layout: "./html.webc",
	eleventyComputed: {
		/**
		 * Must be computed here, not in `_data/`. Eleventy calls a function-exported
		 * global data file ONCE for the whole build and hands it the config-API
		 * global data, not the page's data cascade — so `page`, `metadata` and
		 * `calendar` all arrive empty and every page gets a byte-identical block.
		 * `eleventyComputed` runs per page, which is what the generator needs.
		 */
		structuredDataJson: async (data) =>
			getStructuredData(data.page, data.metadata, data.calendar),
	},
};
