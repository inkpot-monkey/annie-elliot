import { getStructuredData } from "./structuredData.js";

export default function (data) {
  return {
    structuredDataJson: getStructuredData(data.page, data.metadata),
  };
}