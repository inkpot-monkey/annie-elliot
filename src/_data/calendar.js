import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { apiKey } from "@palebluebytes/cms/auth";
import {
	fetchEvents,
	normaliseEvents,
} from "@palebluebytes/cms/calendar/google";
import { formatForDisplay, partition } from "../_lib/event-display.js";

dotenv.config();

// Like src/_data/gallery.js, this module exports ONLY `default` — and now by
// construction, because everything worth naming lives elsewhere: the transport
// and normaliser in the package, the formatting and the partition in src/_lib/.
// An Eleventy `_data/*.js` module with a second export is handed to templates as
// the whole module namespace, and every loop then renders "[object Object]".

// Public calendar id — not secret. Mirrors gallery.js's hard-coded FOLDER_ID.
const CALENDAR_ID = "author.annie.elliot@gmail.com";

/**
 * Every event on the calendar, normalised. Under FIXTURE_DATA it comes from a
 * checked-in payload instead of the live calendar, so the visual baselines stop
 * drifting every time Annie adds an event (see
 * tests/fixtures/calendar-events.json).
 *
 * Only the FETCH is swapped — the fixture goes through the same normaliser the
 * live path runs, so the cancelled-event filter and the inclusive-end correction
 * are still exercised, and there is no `Response` to fake.
 */
async function load() {
	if (process.env.FIXTURE_DATA) {
		return normaliseEvents(
			JSON.parse(
				await readFile(
					new URL("../../tests/fixtures/calendar-events.json", import.meta.url),
					"utf8",
				),
			),
		);
	}

	// One Google API key serves both the Calendar and Drive APIs — they share a
	// Google Cloud project, so GOOGLE_KEY is the single key for both here and in
	// gallery.js. It is read HERE and passed in: the package reads no environment
	// on any runtime, deliberately.
	if (!process.env.GOOGLE_KEY) {
		throw new Error("GOOGLE_KEY not found in environment variables");
	}

	return fetchEvents({
		calendarId: CALENDAR_ID,
		auth: apiKey(process.env.GOOGLE_KEY),
	});
}

export default async function () {
	const events = (await load())
		// ISO strings sort as dates — one reason the package returns strings and
		// not `Date`s. Sort while `start` is still ISO, before formatting.
		.sort((a, b) => a.start.localeCompare(b.start))
		// "Europe/London" is this site's truth, so it lives here. The package
		// returns `timeZone: undefined` rather than guessing for everyone.
		.map((event) =>
			formatForDisplay(event, { fallbackTimeZone: "Europe/London" }),
		);

	// Needs `new Date()`, so it is site code by definition — and the clock is an
	// argument, so it is directly unit-testable rather than only reachable
	// through the `fetch` seam.
	return partition(events, new Date());
}
