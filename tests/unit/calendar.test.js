import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import calendar from "../../src/_data/calendar.js";

// The seam is the module's `fetch` boundary, matching tests/unit/gallery.test.js:
// each test stubs `globalThis.fetch` with a canned events.list payload and sets
// GOOGLE_KEY, and both are restored afterwards so nothing leaks.
//
// These cases are about the REQUEST — which parameters the module sends and how
// it walks pages. Get those wrong and the build is green and the events page is
// quietly incomplete, which is the only reason this file exists.

const realFetch = globalThis.fetch;
const realGoogleKey = process.env.GOOGLE_KEY;
const realFixtureData = process.env.FIXTURE_DATA;

function restoreEnv(name, saved) {
	if (saved === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = saved;
	}
}

// Serve the given pages in order, recording every URL asked for. A page is a
// raw events.list body: `{ timeZone, items, nextPageToken }`.
function mockPages(...pages) {
	const requested = [];
	let call = 0;
	globalThis.fetch = async (url) => {
		requested.push(new URL(url));
		const page = pages[Math.min(call++, pages.length - 1)];
		return {
			ok: true,
			status: 200,
			statusText: "OK",
			json: async () => page,
		};
	};
	return requested;
}

function mockError({ status = 403, statusText = "Forbidden" } = {}) {
	globalThis.fetch = async () => ({
		ok: false,
		status,
		statusText,
		json: async () => ({}),
	});
}

// A timed events.list item. Dates are explicit in every test: `calendar.js`
// partitions future from past against `new Date()`, so a case that cares about
// the partition has to say which side it is on.
function event(summary, startDateTime) {
	return {
		status: "confirmed",
		summary,
		description: `${summary} description`,
		location: "Somewhere",
		start: { dateTime: startDateTime, timeZone: "Europe/London" },
		end: { dateTime: startDateTime, timeZone: "Europe/London" },
	};
}

beforeEach(() => {
	process.env.GOOGLE_KEY = "test-key";
	// The fixture branch short-circuits the fetch entirely; these tests are about
	// what the live branch sends, so make sure a stray FIXTURE_DATA can't hide it.
	delete process.env.FIXTURE_DATA;
});

afterEach(() => {
	globalThis.fetch = realFetch;
	restoreEnv("GOOGLE_KEY", realGoogleKey);
	restoreEnv("FIXTURE_DATA", realFixtureData);
});

// ------------------------------------------------------------------ the query

test("asks the API to expand recurring series into instances", async () => {
	// Google defaults singleEvents to false, which hands back the unexpanded
	// master carrying its RRULE — the formatter below renders that as ONE event
	// on the series' start date.
	const requested = mockPages({ timeZone: "Europe/London", items: [] });

	await calendar();

	assert.equal(requested[0].searchParams.get("singleEvents"), "true");
});

test("orders by startTime, which the API only allows alongside singleEvents", async () => {
	const requested = mockPages({ timeZone: "Europe/London", items: [] });

	await calendar();

	assert.equal(requested[0].searchParams.get("orderBy"), "startTime");
	assert.equal(
		requested[0].searchParams.get("singleEvents"),
		"true",
		"orderBy=startTime without singleEvents is a 400 from Google",
	);
});

test("asks for the largest page the API allows, not the 250 default", async () => {
	const requested = mockPages({ timeZone: "Europe/London", items: [] });

	await calendar();

	assert.equal(requested[0].searchParams.get("maxResults"), "2500");
});

test("does NOT send timeMin — the events page renders past events too", async () => {
	// A timeMin would silently empty the "past events" section. The whole
	// calendar is the page's subject, in both directions.
	const requested = mockPages({ timeZone: "Europe/London", items: [] });

	await calendar();

	assert.equal(requested[0].searchParams.get("timeMin"), null);
	assert.equal(requested[0].searchParams.get("timeMax"), null);
});

// -------------------------------------------------------------- pagination

test("follows nextPageToken and keeps every page's events", async () => {
	const requested = mockPages(
		{
			timeZone: "Europe/London",
			items: [event("Page one", "2099-03-04T19:00:00+00:00")],
			nextPageToken: "token-2",
		},
		{
			timeZone: "Europe/London",
			items: [event("Page two", "2099-03-05T19:00:00+00:00")],
		},
	);

	const { futureEvents } = await calendar();

	assert.equal(requested.length, 2);
	assert.equal(requested[0].searchParams.get("pageToken"), null);
	assert.equal(requested[1].searchParams.get("pageToken"), "token-2");
	assert.deepEqual(
		futureEvents.map((e) => e.summary),
		["Page one", "Page two"],
	);
});

test("throws rather than truncating when the API repeats a pageToken", async () => {
	// A token that hands back itself would loop forever; stopping quietly would
	// drop the tail, which is the bug this whole file guards.
	mockPages({
		timeZone: "Europe/London",
		items: [event("Looping", "2099-03-04T19:00:00+00:00")],
		nextPageToken: "same-token",
	});

	await assert.rejects(() => calendar(), /pageToken/);
});

test("throws rather than paging forever past the cap", async () => {
	// An unbounded recurring series expands without end once singleEvents is on.
	let n = 0;
	globalThis.fetch = async () => ({
		ok: true,
		status: 200,
		statusText: "OK",
		json: async () => ({
			timeZone: "Europe/London",
			items: [event(`Instance ${n}`, "2099-03-04T19:00:00+00:00")],
			nextPageToken: `token-${++n}`,
		}),
	});

	await assert.rejects(() => calendar(), /too many pages/i);
});

// ------------------------------------------------------------------ failures

test("throws when no API key is set", async () => {
	delete process.env.GOOGLE_KEY;
	mockPages({ timeZone: "Europe/London", items: [] });

	await assert.rejects(() => calendar(), /GOOGLE_KEY/);
});

test("throws on a non-OK events.list response", async () => {
	mockError({ status: 403, statusText: "Forbidden" });

	await assert.rejects(() => calendar(), /403/);
});

// ------------------------------------------------------- shape, after paging

test("paged events still partition into future and past around now", async () => {
	mockPages(
		{
			timeZone: "Europe/London",
			items: [event("Long ago", "2019-03-04T19:00:00+00:00")],
			nextPageToken: "token-2",
		},
		{
			timeZone: "Europe/London",
			items: [
				event("Far off", "2099-03-04T19:00:00+00:00"),
				{
					...event("Cancelled", "2099-04-04T19:00:00+00:00"),
					status: "cancelled",
				},
			],
		},
	);

	const { futureEvents, pastEvents } = await calendar();

	assert.deepEqual(
		futureEvents.map((e) => e.summary),
		["Far off"],
		"cancelled events are still dropped",
	);
	assert.deepEqual(
		pastEvents.map((e) => e.summary),
		["Long ago"],
	);
});

test("an events.list body with no items yields empty sections, not a crash", async () => {
	mockPages({ timeZone: "Europe/London" });

	const { futureEvents, pastEvents } = await calendar();

	assert.deepEqual(futureEvents, []);
	assert.deepEqual(pastEvents, []);
});
