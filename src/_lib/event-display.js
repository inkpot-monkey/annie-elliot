/**
 * How this site shows an event: en-GB date strings, and the split into upcoming
 * and past.
 *
 * Everything here has a LOCALE or a CLOCK in it, which is exactly why it is the
 * site's and not the calendar transport's — `google-calendar.js` hands over ISO
 * strings and no opinion. Pure, with the clock passed in.
 */

/**
 * The display shape `src/events.webc` renders and `_lib/structuredData.js`
 * reads: pre-formatted `start`/`end` strings for the page, and the raw ISO
 * `startDateTime`/`endDateTime` for the JSON-LD.
 *
 * @param {import("./google-calendar.js").CalendarEvent} event
 * @param {{fallbackTimeZone: string}} options The zone to format a timed event
 *   in when the event carries none. The calendar API returns `undefined` rather
 *   than guessing, so the guess is made here, where "Europe/London" is true.
 */
export function formatForDisplay(event, { fallbackTimeZone }) {
	const { isAllDay, start, end } = event;

	// An all-day date is floating: `new Date("2099-06-13")` invents an instant at
	// UTC midnight, so format it back in UTC or a spurious time appears — and in
	// a zone west of UTC, the day before.
	const displayOpts = {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: isAllDay ? "UTC" : event.timeZone || fallbackTimeZone,
		...(isAllDay ? {} : { hour: "numeric", minute: "2-digit" }),
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
