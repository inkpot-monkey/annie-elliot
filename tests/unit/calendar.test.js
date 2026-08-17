import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import calendar from "../../src/_data/calendar.js";

// The Eleventy data module: what this SITE does with a normalised calendar —
// which key it reads, which zone it falls back to, and the ordering and
// future/past split the events page renders.
//
// The request contract and the pagination walk are tested in
// `@palebluebytes/cms` rather than here; the formatting and the partition
// have their own direct tests (tests/unit/event-display.test.js). This file still stubs
// `globalThis.fetch`, because the wrapper is what fixes the module's transport.

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

// Serve the given pages in order. A page is a raw events.list body:
// `{ timeZone, items, nextPageToken }`.
function mockPages(...pages) {
	let call = 0;
	globalThis.fetch = async () => {
		const page = pages[Math.min(call++, pages.length - 1)];
		return { ok: true, status: 200, statusText: "OK", json: async () => page };
	};
}

// A timed events.list item. Dates are explicit in every test: this module
// partitions future from past against `new Date()`, so a case that cares about
// the partition has to say which side it is on.
function event(summary, startDateTime) {
	return {
		id: `id-${summary}`,
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
	// what the live branch does, so make sure a stray FIXTURE_DATA can't hide it.
	delete process.env.FIXTURE_DATA;
});

afterEach(() => {
	globalThis.fetch = realFetch;
	restoreEnv("GOOGLE_KEY", realGoogleKey);
	restoreEnv("FIXTURE_DATA", realFixtureData);
});

test("throws when no API key is set", async () => {
	delete process.env.GOOGLE_KEY;
	mockPages({ timeZone: "Europe/London", items: [] });

	await assert.rejects(() => calendar(), /GOOGLE_KEY/);
});

test("throws on a non-OK events.list response", async () => {
	globalThis.fetch = async () => ({
		ok: false,
		status: 403,
		statusText: "Forbidden",
		json: async () => ({}),
	});

	await assert.rejects(() => calendar(), /403/);
});

test("paged events partition into future and past around now", async () => {
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

test("events are ordered by start, whatever order the API returned them in", async () => {
	mockPages({
		timeZone: "Europe/London",
		items: [
			event("Third", "2099-05-04T19:00:00+00:00"),
			event("First", "2099-03-04T19:00:00+00:00"),
			event("Second", "2099-04-04T19:00:00+00:00"),
		],
	});

	const { futureEvents } = await calendar();

	assert.deepEqual(
		futureEvents.map((e) => e.summary),
		["First", "Second", "Third"],
	);
});

test("an events.list body with no items yields empty sections, not a crash", async () => {
	mockPages({ timeZone: "Europe/London" });

	const { futureEvents, pastEvents } = await calendar();

	assert.deepEqual(futureEvents, []);
	assert.deepEqual(pastEvents, []);
});

test("a timed event with no zone of its own is formatted in Europe/London", async () => {
	// The site's fallback, which the calendar transport deliberately does not
	// have: it returns `timeZone: undefined` rather than guessing for everyone.
	mockPages({
		items: [
			{
				...event("Summer evening", "2099-07-04T19:00:00+00:00"),
				start: { dateTime: "2099-07-04T19:00:00+00:00" },
				end: { dateTime: "2099-07-04T20:00:00+00:00" },
			},
		],
	});

	const { futureEvents } = await calendar();

	// 19:00Z in July is 20:00 in London.
	assert.equal(futureEvents[0].start, "Saturday, 4 July 2099 at 20:00");
});

test("the page's display fields are all present on every event", async () => {
	mockPages({
		timeZone: "Europe/London",
		items: [event("Reading", "2099-03-04T19:00:00+00:00")],
	});

	const [e] = (await calendar()).futureEvents;

	assert.equal(e.summary, "Reading");
	assert.equal(e.description, "Reading description");
	assert.equal(e.location, "Somewhere");
	assert.equal(e.start, "Wednesday, 4 March 2099 at 19:00");
	assert.equal(e.isMultiDay, false);
	// The JSON-LD's inputs — see src/_lib/structuredData.js.
	assert.equal(e.startDateTime, "2099-03-04T19:00:00+00:00");
	assert.equal(e.endDateTime, "2099-03-04T19:00:00+00:00");
});

test("FIXTURE_DATA reads the checked-in payload through the same normaliser", async () => {
	// No network, and no faked Response — the fixture is a raw events.list body,
	// so it goes straight through normaliseEvents.
	process.env.FIXTURE_DATA = "1";
	globalThis.fetch = async () => {
		throw new Error("the fixture path must not touch the network");
	};

	const { futureEvents, pastEvents } = await calendar();

	// The fixtures sit in 2099 and 2019 on purpose, so the partition cannot flip
	// as real time passes.
	assert.deepEqual(
		futureEvents.map((e) => e.summary),
		["Bookshop Reading", "Literary Festival Weekend", "Library Talk"],
	);
	assert.ok(pastEvents.length > 0);

	// Google's all-day end.date is exclusive: 13th-to-17th displays as ending on
	// the 16th.
	const festival = futureEvents[1];
	assert.equal(festival.isMultiDay, true);
	assert.equal(festival.start, "Saturday, 13 June 2099");
	assert.equal(festival.end, "Tuesday, 16 June 2099");
});
