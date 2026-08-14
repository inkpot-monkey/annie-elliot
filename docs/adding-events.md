# How Annie adds book events to the website

The **Events** page is built from your own Google Calendar — the one on your
`author.annie.elliot@gmail.com` account. You add an event there in the normal
way, and the website picks it up. No developer and no code change needed.

Events move from **Upcoming Events** to **Past Events** by themselves once the
date has passed, so there is nothing to tidy up afterwards.

---

## Add an event

Create the event in Google Calendar on your `author.annie.elliot@gmail.com`
account. Four things you type become four things on the page:

| In Google Calendar | On the website                                 |
| ------------------ | ---------------------------------------------- |
| **Title**          | the event heading                              |
| **Date and time**  | the date line underneath                       |
| **Location**       | shown under the date, and links to Google Maps |
| **Description**    | the paragraph describing the event             |

Only the **title** and the **date** are required. Location and description are
each left out if you leave them blank.

> **Put it on your main calendar.** The website reads only the default calendar
> on that account. If you make a separate calendar (say, "Book events") and add
> it there, it will not appear on the site.

## Dates and times

- **Give it a time** and the page shows the time — "Thursday 4 September 2026,
  7:30 pm".
- **Make it an all-day event** and the page shows just the date — "Thursday 4
  September 2026". Use this when the time isn't settled yet, or for something
  that runs all day.
- **Spanning several days?** Set the start and end dates as you normally would
  and the page shows the range. You don't need to do anything clever with the end
  date — the website handles Google's quirk of treating it as the morning after.

## Writing the description

The description is shown as a single plain paragraph, so:

- **Write it as ordinary sentences.** Bold, italics, bullet points and links
  won't come through — you'd see the formatting codes instead of the effect.
- **Avoid blank lines and paragraph breaks.** If you paste text that has them,
  run it together into one paragraph.
- If you want to point people at a ticket page, write the address out in words —
  it won't become a clickable link, so make it something readable.

## Change or cancel an event

- **Editing** an event — the time, the venue, the description — updates the
  website the next time it is rebuilt.
- **Deleting** an event removes it from the site.
- **Cancelling** an event (rather than deleting it) also removes it — the site
  skips cancelled events entirely, so it will not show as a struck-through or
  "cancelled" entry. If you want people to _know_ it was cancelled, keep the
  event and say so in the description instead.

## Publish your changes

Your calendar changes are **not** live instantly. The site has to be **rebuilt**
to pick them up.

**This happens on its own, once a day.** So an event you add today appears on the
site within 24 hours without you doing anything.

**If you need it live sooner:**

1. Sign in to the Cloudflare dashboard (<https://dash.cloudflare.com>) and open
   **Workers & Pages**.
2. Open the **annie-elliot** project, then the **Deployments** tab.
3. On the most recent deployment, open the **⋯** menu and choose **Retry
   deployment**.
4. Wait for the build to finish — a minute or two, until its status shows
   **Success**.
5. Refresh the Events page; your change is now live.

This is the same procedure as publishing a new gallery photo, so if you have done
that before it will look familiar.

## Keep the calendar public

The calendar must stay set to **"Make available to public"** in its settings —
that is how the website is able to read it. If that is ever turned off, the
Events page will stop updating (and a rebuild will fail), so leave it as is.
