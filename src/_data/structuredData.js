import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "../../package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

const siteUrl = "https://annieelliot.co.uk";

async function fetchCalendarEvents() {
  const calendarId = "author.annie.elliot@gmail.com";
  const apiKey = process.env.CALENDAR_KEY;

  if (!apiKey) {
    console.warn("CALENDAR_KEY not found in environment variables");
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}`,
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch calendar events:",
        response.status,
        response.statusText,
      );
      return null;
    }

    const data = await response.json();
    const events = data.items
      .map(({ summary, description, location, start, end }) => ({
        summary,
        description,
        location,
        startDateTime: start.dateTime,
        endDateTime: end?.dateTime || null,
      }))
      .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

    const now = new Date();
    const futureEvents = events.filter(
      (event) => new Date(event.startDateTime) > now,
    );

    return {
      futureEvents: futureEvents,
    };
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return null;
  }
}

export async function getStructuredData(page, metadata) {
  // Prioritize metadata.pageType, fallback to checking page URL
  let pageType = metadata?.pageType;
  if (!pageType) {
    const pageUrlValue = page?.url || "";
    // Check for events page
    if (pageUrlValue.includes("/events")) {
      pageType = "events";
    } else if (
      pageUrlValue === "/" ||
      pageUrlValue === "" ||
      pageUrlValue.endsWith("/index.html")
    ) {
      pageType = "book";
    } else {
      pageType = "website";
    }
  }

  const structuredData = [];

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
      "name": "Mr & Mrs Charles Dickens: Her Story",
      "author": {
        "@type": "Person",
        "name": "Annie Elliot",
        "url": siteUrl // Used siteUrl instead of hardcoding as per pattern, but schema requested hardcoded url in example. Keeping consistent with existing code pattern or following request strictly? Request said: "url": "[https://annieelliot.co.uk](https://annieelliot.co.uk)" which is siteUrl.
      },
      "workExample": {
        "@type": "Book",
        "isbn": "978-1784650961",
        "bookFormat": "https://schema.org/Paperback"
      },
      "image": siteUrl + "/images/book-cover.jpg",
      "description": "The untold story of Catherine Dickens, wife of Charles Dickens, reimagining her life and marriage."
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
    ...(packageJson.keywords &&
      packageJson.keywords.length > 0 && {
      keywords: packageJson.keywords.join(", "),
    }),
  };
  structuredData.push(websiteSchema);

  // Event schemas - for events page
  if (pageType === "events") {
    const events = await fetchCalendarEvents();
    if (
      events &&
      Array.isArray(events.futureEvents) &&
      events.futureEvents.length > 0
    ) {
      events.futureEvents.forEach((event) => {
        if (event.startDateTime) {
          const eventSchema = {
            "@context": "https://schema.org",
            "@type": "Event",
            name: event.summary || "Book Event",
            description:
              event.description ||
              `Book event with Annie Elliot, author of Mr & Mrs Charles Dickens`,
            startDate: event.startDateTime,
            ...(event.endDateTime && { endDate: event.endDateTime }),
            location: {
              "@type": "Place",
              name: event.location || "TBA",
              ...(event.location &&
                event.location !== "TBA" && {
                address: {
                  "@type": "PostalAddress",
                  addressLocality: event.location,
                },
              }),
            },
            organizer: {
              "@type": "Person",
              name: "Annie Elliot",
              url: siteUrl + "/author/",
            },
            eventAttendanceMode:
              "https://schema.org/OfflineEventAttendanceMode",
            eventStatus: "https://schema.org/EventScheduled",
          };
          structuredData.push(eventSchema);
        }
      });
    }
  }

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
