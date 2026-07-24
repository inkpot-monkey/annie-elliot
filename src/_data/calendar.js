import dotenv from "dotenv";

dotenv.config();

export default async function () {
    const calendarId = "author.annie.elliot@gmail.com";
    const apiKey = process.env.CALENDAR_KEY;

    if (!apiKey) {
        throw new Error("CALENDAR_KEY not found in environment variables");
    }

    const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&t=${Date.now()}`,
    );

    if (!response.ok) {
        throw new Error(
            `Failed to fetch calendar events: ${response.status} ${response.statusText}`,
        );
    }

    const data = await response.json();
    const calendarTimeZone = data.timeZone || 'Europe/London';
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
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: isAllDay ? 'UTC' : eventTimeZone,
                ...(isAllDay ? {} : { hour: 'numeric', minute: '2-digit' }),
            };
            const format = (iso) =>
                new Date(iso).toLocaleDateString('en-GB', displayOpts);

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
                new Date(iso).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    timeZone: isAllDay ? 'UTC' : eventTimeZone,
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
                isMultiDay: Boolean(endDisplayDt) && dayKey(startDt) !== dayKey(endDisplayDt),
            };
        })
        .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));

    const now = new Date();
    const futureEvents = events.filter(
        (event) => new Date(event.startDateTime) > now,
    );
    const pastEvents = events.filter(
        (event) => new Date(event.startDateTime) <= now,
    );

    return {
        futureEvents,
        pastEvents,
    };
}
