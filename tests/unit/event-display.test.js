import test from "node:test";
import assert from "node:assert/strict";

import { formatForDisplay, partition } from "../../src/_lib/event-display.js";

// Everything with a LOCALE or a CLOCK in it: the en-GB date strings the events
// page prints, and the future/past split. Both used to be reachable only through
// src/_data/calendar.js's `fetch` seam; the clock is now an argument, so the
// partition is testable without waiting for 2099.

const timed = (extra = {}) => ({
	id: "id-1",
	summary: "Bookshop Reading",
	description: "An evening reading.",
	location: "The Assembly Rooms",
	// "instant" and not merely "timed": the string carries an offset, which is
	// what makes it safe to hand to `new Date()`. Google returns only this and
	// "date"; an .ics calendar can also return a wall time, which
	// `formatForDisplay` refuses rather than print an hour nobody scheduled.
	kind: "instant",
	isMultiDay: false,
	start: "2099-03-04T19:00:00+00:00",
	end: "2099-03-04T20:30:00+00:00",
	timeZone: "Europe/London",
	...extra,
});

const allDay = (extra = {}) => ({
	id: "id-2",
	summary: "Literary Festival Weekend",
	description: "A weekend of talks.",
	location: "Riverside Pavilion",
	kind: "date",
	isMultiDay: true,
	start: "2099-06-13",
	end: "2099-06-16", // already the INCLUSIVE last day
	timeZone: "Europe/London",
	...extra,
});

// --------------------------------------------------------- formatForDisplay

test("a timed event prints the weekday, the date and the time in its own zone", () => {
	const e = formatForDisplay(timed(), { fallbackTimeZone: "Europe/London" });

	assert.equal(e.start, "Wednesday, 4 March 2099 at 19:00");
	assert.equal(e.end, "Wednesday, 4 March 2099 at 20:30");
});

test("an all-day event prints no time at all", () => {
	// The regression this guards: an all-day date is FLOATING, and
	// `new Date("2099-06-13")` invents an instant at UTC midnight. Formatting
	// that in any other zone prints a spurious time — and in a negative offset,
	// the day before.
	const e = formatForDisplay(allDay(), { fallbackTimeZone: "Europe/London" });

	assert.equal(e.start, "Saturday, 13 June 2099");
	assert.equal(e.end, "Tuesday, 16 June 2099");
	assert.ok(!/\d\d:\d\d/.test(e.start), "no time in an all-day date");
});

test("an all-day date holds its day in a zone west of UTC", () => {
	const e = formatForDisplay(allDay(), {
		fallbackTimeZone: "America/New_York",
	});

	assert.equal(e.start, "Saturday, 13 June 2099", "not the 12th");
});

test("the fallback zone is used only when the event carries none", () => {
	const own = formatForDisplay(timed({ timeZone: "Europe/Paris" }), {
		fallbackTimeZone: "Europe/London",
	});
	const fallen = formatForDisplay(timed({ timeZone: undefined }), {
		fallbackTimeZone: "Europe/Paris",
	});

	// 19:00Z is 20:00 in Paris; both routes reach the same place.
	assert.equal(own.start, "Wednesday, 4 March 2099 at 20:00");
	assert.equal(fallen.start, "Wednesday, 4 March 2099 at 20:00");
});

test("the raw ISO strings survive as startDateTime/endDateTime for the JSON-LD", () => {
	const e = formatForDisplay(timed(), { fallbackTimeZone: "Europe/London" });

	assert.equal(e.startDateTime, "2099-03-04T19:00:00+00:00");
	assert.equal(e.endDateTime, "2099-03-04T20:30:00+00:00");
});

test("summary, description, location and isMultiDay come through", () => {
	const e = formatForDisplay(allDay(), { fallbackTimeZone: "Europe/London" });

	assert.equal(e.summary, "Literary Festival Weekend");
	assert.equal(e.description, "A weekend of talks.");
	assert.equal(e.location, "Riverside Pavilion");
	assert.equal(e.isMultiDay, true);
});

test("an event with no end has no end display, rather than a repeated start", () => {
	const e = formatForDisplay(timed({ end: undefined }), {
		fallbackTimeZone: "Europe/London",
	});

	assert.equal(e.end, null);
	assert.equal(e.endDateTime, undefined);
});

// ------------------------------------------------------------------ partition

const at = (start, summary) => ({ startDateTime: start, summary });

test("future is what starts after now; past is everything else", () => {
	const now = new Date("2026-08-16T12:00:00Z");

	const { futureEvents, pastEvents } = partition(
		[
			at("2019-03-04T19:00:00+00:00", "Long ago"),
			at("2026-08-16T18:00:00+00:00", "Tonight"),
			at("2099-03-04T19:00:00+00:00", "Far off"),
		],
		now,
	);

	assert.deepEqual(
		futureEvents.map((e) => e.summary),
		["Tonight", "Far off"],
	);
	assert.deepEqual(
		pastEvents.map((e) => e.summary),
		["Long ago"],
	);
});

test("past events read most-recent first", () => {
	const now = new Date("2026-08-16T12:00:00Z");

	const { pastEvents } = partition(
		[
			at("2019-02-12T09:15:00+00:00", "Oldest"),
			at("2019-07-16T14:00:00+01:00", "Middle"),
			at("2019-11-08T18:30:00+00:00", "Newest"),
		],
		now,
	);

	assert.deepEqual(
		pastEvents.map((e) => e.summary),
		["Newest", "Middle", "Oldest"],
	);
});

test("an event starting exactly now counts as past, not future", () => {
	const now = new Date("2026-08-16T12:00:00Z");

	const { futureEvents, pastEvents } = partition(
		[at("2026-08-16T12:00:00+00:00", "Right now")],
		now,
	);

	assert.deepEqual(futureEvents, []);
	assert.equal(pastEvents.length, 1);
});

test("an all-day date partitions on its UTC midnight", () => {
	// Floating dates have no instant, so the split has to pick one. UTC midnight
	// is the same choice the display makes, which keeps the two consistent.
	const { futureEvents, pastEvents } = partition(
		[at("2026-08-16", "Today"), at("2026-08-17", "Tomorrow")],
		new Date("2026-08-16T12:00:00Z"),
	);

	assert.deepEqual(
		futureEvents.map((e) => e.summary),
		["Tomorrow"],
	);
	assert.deepEqual(
		pastEvents.map((e) => e.summary),
		["Today"],
	);
});

test("no events is two empty sections, not a crash", () => {
	assert.deepEqual(partition([], new Date("2026-08-16T12:00:00Z")), {
		futureEvents: [],
		pastEvents: [],
	});
});
