/**
 * How this site shows an event: en-GB date strings, and the split into upcoming
 * and past.
 *
 * Everything here has a LOCALE or a CLOCK in it, which is exactly why it is the
 * site's and not the package's — `@palebluebytes/cms` hands over ISO
 * strings and no opinion. Pure, with the clock passed in.
 */

/**
 * The display shape `src/events.webc` renders and `_lib/structuredData.js`
 * reads: pre-formatted `start`/`end` strings for the page, and the raw ISO
 * `startDateTime`/`endDateTime` for the JSON-LD.
 *
 * @param {import("@palebluebytes/cms/calendar/google").CalendarEvent} event
 * @param {{fallbackTimeZone: string}} options The zone to format a timed event
 *   in when the event carries none. The package returns `undefined` rather than
 *   guessing, so the guess is made here, where "Europe/London" is true.
 */
export function formatForDisplay(event, { fallbackTimeZone }) {
	const { kind, start, end } = event;

	// `kind` replaced an `isAllDay` boolean, because a calendar can state a time
	// in four forms and only one of them is an instant. This site reads Google,
	// which returns just the two — so the other two arriving means someone
	// pointed it at an .ics calendar, and formatting a WALL TIME through a zone
	// would silently print an hour the file never stated.
	if (kind !== "date" && kind !== "instant") {
		throw new Error(
			`event "${event.summary}" has kind "${kind}", which carries no offset. ` +
				`Resolve it to an instant before formatting, or this page prints a ` +
				`time nobody scheduled.`,
		);
	}

	// Not named for the package's `"floating"` kind, which is a WALL TIME and is
	// rejected above; this is the date-only kind.
	const isDateOnly = kind === "date";

	// An all-day date has no offset either: `new Date("2099-06-13")` invents an
	// instant at UTC midnight, so format it back in UTC or a spurious time
	// appears — and in a zone west of UTC, the day before.
	const displayOpts = {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: isDateOnly ? "UTC" : event.timeZone || fallbackTimeZone,
		...(isDateOnly ? {} : { hour: "numeric", minute: "2-digit" }),
	};
	const format = (iso) =>
		new Date(iso).toLocaleDateString("en-GB", displayOpts);

	return {
		summary: event.summary,
		description: event.description,
		location: event.location,
		// Raw ISO, for schema.org. `end` is the inclusive last day, which is what
		// a reader — human or crawler — takes an end date to mean.
		startDateTime: start,
		endDateTime: end,
		start: format(start),
		end: end ? format(end) : null,
		isMultiDay: event.isMultiDay,
	};
}

/**
 * Upcoming and past, around a caller-supplied instant. The clock is an argument
 * so this is testable without waiting for 2099 — the fixture events sit in 2019
 * and 2099 for the same reason.
 *
 * @param {{startDateTime: string}[]} events Sorted ascending.
 * @param {Date} now
 */
export function partition(events, now) {
	return {
		futureEvents: events.filter((event) => new Date(event.startDateTime) > now),
		// Past events show most-recent first — the reverse of the ascending order
		// they arrive in.
		pastEvents: events
			.filter((event) => new Date(event.startDateTime) <= now)
			.reverse(),
	};
}
