import { getStructuredData } from "./_data/structuredData.js";

// Generate structured data for the events page
// .11tydata.js files receive data early in the cascade
// Front matter data is merged into the data object directly
export default async function (data) {
  // In .11tydata.js, front matter is merged into data directly
  // So metadata.pageType becomes available as data.metadata.pageType
  // But data.page might not be available yet - we'll construct a minimal page object
  
  // Get metadata from data (front matter is merged in)
  const metadata = data.metadata || {};
  
  // Construct a minimal page object for getStructuredData
  // The actual page.url will be set later, but we know this is the events page
  const page = {
    url: '/events/',
    ...(data.page || {})
  };
  
  // Ensure pageType is set - explicitly set to "events" since this is events.11tydata.js
  const metadataWithPageType = {
    ...metadata,
    pageType: 'events'  // Explicitly set since we know this is the events page
  };
  
  const structuredDataJson = await getStructuredData(page, metadataWithPageType);
  
  return {
    structuredDataJson: structuredDataJson,
  };
}
