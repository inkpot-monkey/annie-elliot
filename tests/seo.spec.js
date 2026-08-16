import { test, expect } from "@playwright/test";

/** Every JSON-LD node on the page, flattened out of its `<script>` arrays. */
async function readJsonLd(page) {
	const blocks = await page.$$eval(
		'script[type="application/ld+json"]',
		(scripts) =>
			scripts
				.map((s) => {
					try {
						return JSON.parse(s.innerText);
					} catch (e) {
						return null;
					}
				})
				.filter((s) => s !== null),
	);
	return blocks.flat();
}

test.describe("SEO Checks", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	test("should have correct title", async ({ page }) => {
		await expect(page).toHaveTitle(
			"Mr & Mrs Charles Dickens: Her Story | A Novel by Annie Elliot",
		);
	});

	test("should have correct meta description", async ({ page }) => {
		const metaDescription = page.locator('meta[name="description"]');
		await expect(metaDescription).toHaveAttribute(
			"content",
			/Discover the untold story of Mrs Dickens\. Annie Elliot['’]s historical novel reveals the life of Catherine Dickens, the woman behind the famous author\./,
		);
	});

	test("should have viewport meta tag", async ({ page }) => {
		const viewport = page.locator('meta[name="viewport"]');
		await expect(viewport).toHaveCount(1);
	});

	test("should have correct Open Graph tags", async ({ page }) => {
		await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
			"content",
			"Mr & Mrs Charles Dickens: Her Story | A Novel by Annie Elliot",
		);

		await expect(
			page.locator('meta[property="og:description"]'),
		).toHaveAttribute(
			"content",
			/Discover the untold story of Mrs Dickens\. Annie Elliot['’]s historical novel reveals the life of Catherine Dickens, the woman behind the famous author\./,
		);

		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
			"content",
			"https://annieelliot.co.uk/images/book-cover.jpg",
		);

		// Check fuzzy match for URL since it might vary locally vs production canonical
		// But the layout code uses metadata.canonical OR constructed URL.
		// Let's check if the tag exists and has a value similar to expected.
		const ogUrl = await page
			.locator('meta[property="og:url"]')
			.getAttribute("content");
		expect(ogUrl).toContain("annieelliot.co.uk");
	});

	test("should include Book JSON-LD schema", async ({ page }) => {
		const schemas = await readJsonLd(page);
		const bookSchema = schemas.find((s) => s["@type"] === "Book");

		expect(bookSchema).toBeDefined();
		expect(bookSchema.name).toBe("Mr & Mrs Charles Dickens: Her Story");
		expect(bookSchema.author.name).toBe("Annie Elliot");
		expect(bookSchema.workExample.isbn).toBe("978-1784650961");
		expect(bookSchema.image).toContain("/images/book-cover.jpg");
	});

	test("should not carry Event schema on the home page", async ({ page }) => {
		const schemas = await readJsonLd(page);
		expect(schemas.filter((s) => s["@type"] === "Event")).toHaveLength(0);
	});

	test("should have semantic review markup", async ({ page }) => {
		const reviewsSection = page.locator("#reviews");

		// Only run if reviews section is present (it is on homepage)
		if ((await reviewsSection.count()) > 0) {
			// Check for figure, blockquote, figcaption
			await expect(
				reviewsSection.locator("figure.review-card").first(),
			).toBeVisible();
			await expect(
				reviewsSection.locator("blockquote.quote").first(),
			).toBeVisible();
			await expect(
				reviewsSection.locator("figcaption.reviewer").first(),
			).toBeVisible();

			// Check for correct heading level
			await expect(reviewsSection.locator("h3")).toBeVisible();
			await expect(reviewsSection.locator("h3")).toHaveText("Reviews");
		}
	});
});

/**
 * Structured data is computed per page (`src/src.11tydata.js`), so each page gets
 * a different set of schemas. It used to be computed once per build from empty
 * inputs, which put Book on all seven pages and Event on none — a green build
 * that silently published the wrong schema. These assertions are the guard.
 */
test.describe("Per-page structured data", () => {
	test("Book schema appears only on the home page", async ({ page }) => {
		for (const url of ["/author/", "/reviews/", "/contact/", "/events/"]) {
			await page.goto(url);
			const schemas = await readJsonLd(page);
			expect(
				schemas.filter((s) => s["@type"] === "Book"),
				`Book schema should not appear on ${url}`,
			).toHaveLength(0);
			// Person and WebSite are on every page.
			expect(schemas.map((s) => s["@type"])).toEqual(
				expect.arrayContaining(["Person", "WebSite"]),
			);
		}
	});

	test("events page carries an Event schema per upcoming event", async ({
		page,
	}) => {
		await page.goto("/events/");
		const events = (await readJsonLd(page)).filter(
			(s) => s["@type"] === "Event",
		);

		// The three 2099 fixture events; the 2019 ones are past and the cancelled
		// one is filtered out in calendar.js.
		expect(events.map((e) => e.name)).toEqual([
			"Bookshop Reading",
			"Literary Festival Weekend",
			"Library Talk",
		]);

		// Google's all-day `end.date` is EXCLUSIVE — the festival arrives ending on
		// the 17th — and the calendar layer steps it back, so the schema's endDate
		// is the same last day the page prints ("Tuesday, 16 June 2099").
		const festival = events[1];
		expect(festival.startDate).toBe("2099-06-13");
		expect(festival.endDate).toBe("2099-06-16");

		const reading = events[0];
		expect(reading.startDate).toBe("2099-03-04T19:00:00+00:00");
		expect(reading.location["@type"]).toBe("Place");
		expect(reading.location.name).toContain("The Assembly Rooms");
		expect(reading.organizer.name).toBe("Annie Elliot");
	});

	test("page description reaches the WebSite schema", async ({ page }) => {
		await page.goto("/events/");
		const website = (await readJsonLd(page)).find(
			(s) => s["@type"] === "WebSite",
		);
		expect(website.description).toContain("Find upcoming book events");
	});
});
