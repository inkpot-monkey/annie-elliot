import dotenv from "dotenv";

dotenv.config();

export default async function () {
    const calendarId = "author.annie.elliot@gmail.com";
    const apiKey = process.env.CALENDAR_KEY;

    if (!apiKey) {
        console.warn("CALENDAR_KEY not found in environment variables");
        return { futureEvents: [], pastEvents: [] };
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?key=${apiKey}&t=${Date.now()}`,
        );

        if (!response.ok) {
            console.error(
                "Failed to fetch calendar events:",
                response.status,
                response.statusText,
            );
            return { futureEvents: [], pastEvents: [] };
        }

        const data = await response.json();
        const events = data.items
            .map(({ summary, description, location, start, end }) => {
                const startDt = start.dateTime || start.date;
                const endDt = end?.dateTime || end?.date || null;

                // Helper to format date for display if needed here, 
                // but typically raw data is better in _data and formatting in filters/templates.
                // Keeping raw ISO strings for calculations.

                return {
                    summary,
                    description,
                    location,
                    startDateTime: startDt,
                    endDateTime: endDt,
                    // Pre-calculate display string to match previous client-side logic
                    start: new Date(startDt).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    })
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
    } catch (error) {
        console.error("Error fetching calendar events:", error);
        return { futureEvents: [], pastEvents: [] };
    }
}
