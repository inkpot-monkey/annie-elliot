import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const siteUrl = "https://annieelliot.co.uk";

export function getStructuredData(page, metadata) {
  // Prioritize metadata.pageType, fallback to checking page URL
  let pageType = metadata?.pageType;
  if (!pageType) {
    const pageUrlValue = page?.url || "";
    pageType =
      pageUrlValue === "/" ||
      pageUrlValue === "" ||
      pageUrlValue.endsWith("/index.html")
        ? "book"
        : "website";
  }
  const pageUrl = siteUrl + (page?.url || "/");
  const structuredData = [];

  // Base breadcrumb for all pages
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
    ],
  };

  // Add current page to breadcrumbs
  if (page?.url && page.url !== "/") {
    const pageName = getPageName(page.url);
    breadcrumbs.itemListElement.push({
      "@type": "ListItem",
      position: 2,
      name: pageName,
      item: pageUrl,
    });
  }

  structuredData.push(breadcrumbs);

  // Person schema (Author) - for all pages
  const authorSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Annie Elliot",
    url: siteUrl,
    jobTitle: "Author",
    description:
      "Annie Elliot is the author of Mr & Mrs Charles Dickens, Her Story. She has an MA in Creative Writing and a BA (Hons) in Literary Studies.",
    sameAs: "https://annieelliot.co.uk",
  };
  structuredData.push(authorSchema);

  // Book schema - for home page
  const isHomePage =
    pageType === "book" ||
    page?.url === "/" ||
    page?.url === "/index.html" ||
    !page?.url ||
    (page?.url && page.url.endsWith("/index.html"));
  if (isHomePage) {
    const bookSchema = {
      "@context": "https://schema.org",
      "@type": "Book",
      name: "Mr & Mrs Charles Dickens",
      alternateName: "Mr & Mrs Charles Dickens, Her Story",
      author: {
        "@type": "Person",
        name: "Annie Elliot",
        url: siteUrl + "/author/",
      },
      description:
        "After twenty-two years of marriage, Charles Dickens banished his wife Kate from their home and nine children. This is Kate's story: a poignant self-portrait of a woman struggling to achieve peace of mind.",
      url: siteUrl,
      publisher: {
        "@type": "Organization",
        name: "Annie Elliot",
      },
      inLanguage: "en-GB",
      bookFormat: "https://schema.org/Hardcover",
    };
    structuredData.push(bookSchema);
  }

  // WebSite schema - for all pages
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Annie Elliot - Mr & Mrs Charles Dickens",
    url: packageJson.homepage || siteUrl,
    author: {
      "@type": "Person",
      name: "Annie Elliot",
    },
    creator: {
      "@type": "Organization",
      name: "Pale Blue Bytes",
      url: "https://palebluebytes.space",
    },
    description:
      metadata?.description ||
      packageJson.description ||
      "A website for the novel Mr & Mrs Dickens, Her Story by the author Annie Elliot",
    // Add software information if available
    ...(packageJson.name && { softwareVersion: packageJson.version }),
    // Add keywords if available
    ...(packageJson.keywords && packageJson.keywords.length > 0 && { keywords: packageJson.keywords.join(", ") }),
  };
  structuredData.push(websiteSchema);

  return JSON.stringify(structuredData);
}

function getPageName(url) {
  const pageNames = {
    "/author/": "About the Author",
    "/events/": "Events",
    "/contact/": "Contact",
  };
  return pageNames[url] || "Page";
}
