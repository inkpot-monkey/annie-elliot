import dotenv from "dotenv";
import { readFile } from "node:fs/promises";

dotenv.config();

// Public calendar id — not secret. Mirrors gallery.js's hard-coded FOLDER_ID.
const CALENDAR_ID = "author.annie.elliot@gmail.com";

// 2500 is the API's ceiling; its DEFAULT is 250, which is the size of the tail a
// growing calendar would lose without the pagination loop below.
const PAGE_SIZE = 2500;

// A backstop, not a budget: 10 000 events is two orders of magnitude past
// anything this calendar will hold, so tripping it means the walk is not
// terminating — an unbounded recurring series expanded by `singleEvents`, or an
// API paging bug. Failing loudly beats either looping forever or truncating.
const MAX_PAGES = 4;

/**
 * Every event on the calendar, as `{ timeZone, items }`. Under FIXTURE_DATA it
 * comes from a checked-in file instead of the live calendar, so the visual
 * baselines stop drifting every time Annie adds an event (see
 * tests/fixtures/calendar-events.json). Only the fetch is swapped: everything
 * below still formats and partitions for real.
 *
 * Three query parameters carry the correctness here, and all three are things
 * Google gets wrong by default:
 *
 * - `singleEvents=true` expands a recurring series into its instances. The
 *   default is `false`, which returns the unexpanded master carrying its
 *   `RRULE` — and the formatter below has no idea what an RRULE is, so a weekly
 *   series would render as a single event on the series' start date.
 * - `orderBy=startTime` makes the page walk deterministic. The API only accepts
 *   it alongside `singleEvents=true`. The local sort further down stays the
 *   authority on display order.
 * - `maxResults` + `nextPageToken`: the default page is 250 events and a single
 *   un-paginated request simply drops everything past it, silently.
 *
 * There is deliberately **no `timeMin`/`timeMax`**. The events page renders past
 * appearances as well as future ones, so bounding the window server-side would
 * empty a section of the page rather than protect it; MAX_PAGES is what bounds
 * the walk instead. Recurrence only ever expands forwards from its start, so
 * omitting `timeMin` cannot itself run away.
 */
async function fetchEvents() {
	if (process.env.FIXTURE_DATA) {
		return JSON.parse(
			await readFile(
				new URL("../../tests/fixtures/calendar-events.json", import.meta.url),
				"utf8",
			),
		);
	}

	const apiKey = process.env.GOOGLE_KEY;

	if (!apiKey) {
		throw new Error("GOOGLE_KEY not found in environment variables");
	}

	const cacheBuster = String(Date.now());
	const items = [];
	let timeZone;
	let pageToken;

	for (let page = 1; ; page++) {
		if (page > MAX_PAGES) {
			throw new Error(
				`Calendar walk took too many pages (>${MAX_PAGES} x ${PAGE_SIZE} events). ` +
					`A recurring event with no end date expands without limit under singleEvents.`,
			);
		}

		const params = new URLSearchParams({
			key: apiKey,
			singleEvents: "true",
			orderBy: "startTime",
			maxResults: String(PAGE_SIZE),
			t: cacheBuster,
		});
		if (pageToken) params.set("pageToken", pageToken);

		const response = await fetch(
			`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`,
		);

		if (!response.ok) {
			throw new Error(
				`Failed to fetch calendar events: ${response.status} ${response.statusText}`,
			);
		}

		const body = await response.json();
		items.push(...(body.items ?? []));
		timeZone ??= body.timeZone;

		if (!body.nextPageToken) break;
		if (body.nextPageToken === pageToken) {
			throw new Error(
				`Calendar returned the same pageToken twice — refusing to loop or to ` +
					`truncate at ${items.length} events.`,
			);
		}
		pageToken = body.nextPageToken;
	}

	return { timeZone, items };
}

export default async function () {
	const data = await fetchEvents();
	const calendarTimeZone = data.timeZone || "Europe/London";
	const events = data.items
		.filter((event) => event.status !== "cancelled" && event.start)
		.map(({ summary, description, location, start, end }) => {
			// All-day events use `date` (YYYY-MM-DD); timed events use `dateTime`.
			const isAllDay = !start.dateTime;
			const startDt = start.dateTime || start.date;
			const endDt = end?.dateTime || end?.date || null;
			const eventTimeZone = start.timeZone || calendarTimeZone;

			// All-day dates are floating (no offset), so format them in UTC to
			// avoid a spurious time appearing; timed events keep hour/minute.
			const displayOpts = {
				weekday: "long",
				day: "numeric",
				month: "long",
				year: "numeric",
				timeZone: isAllDay ? "UTC" : eventTimeZone,
				...(isAllDay ? {} : { hour: "numeric", minute: "2-digit" }),
			};
			const format = (iso) =>
				new Date(iso).toLocaleDateString("en-GB", displayOpts);

			// Google's all-day `end.date` is exclusive — step back a day so a
			// 13–17 range displays as ending on the 16th.
			let endDisplayDt = endDt;
			if (isAllDay && endDt) {
				const d = new Date(endDt);
				d.setUTCDate(d.getUTCDate() - 1);
				endDisplayDt = d.toISOString().slice(0, 10);
			}

			const startDisplay = format(startDt);
			const endDisplay = endDisplayDt ? format(endDisplayDt) : null;

			// Compare calendar days only (ignore time) to detect multi-day spans.
			const dayKey = (iso) =>
				new Date(iso).toLocaleDateString("en-GB", {
					day: "numeric",
					month: "long",
					year: "numeric",
					timeZone: isAllDay ? "UTC" : eventTimeZone,
				});

			return {
				summary,
				description,
				location,
				startDateTime: startDt,
				endDateTime: endDt,
				// Pre-calculated display strings
				start: startDisplay,
				end: endDisplay,
				// True when the event spans more than one calendar day.
				isMultiDay:
					Boolean(endDisplayDt) && dayKey(startDt) !== dayKey(endDisplayDt),
			};
		})
		.sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

	const now = new Date();
	const futureEvents = events.filter(
		(event) => new Date(event.startDateTime) > now,
	);
	// Past events show most-recent first (reverse of the ascending sort above).
	const pastEvents = events
		.filter((event) => new Date(event.startDateTime) <= now)
		.reverse();

	return {
		futureEvents,
		pastEvents,
	};
}
