import { getStructuredData } from "./structuredData.js";

export default {
  getStructuredData: async (page, metadata) => {
    return await getStructuredData(page, metadata);
  },
};