import { getStructuredData } from "./structuredData.js";

export default async function (data) {
	// Use metadata from the data cascade
	const metadata = data.metadata || {};
	const page = data.page || {};
	const calendar = data.calendar || {};

	// If page-specific data already has structuredDataJson, don't override it
	// (though we'll remove them in next steps)
	if (data.structuredDataJson) return data.structuredDataJson;

	return await getStructuredData(page, metadata, calendar);
}
