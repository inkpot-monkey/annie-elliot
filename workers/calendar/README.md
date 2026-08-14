# calendar worker

Rebuilds the site once a day so live Google data reaches the published pages.

## What it does

One cron trigger, `0 0 * * *` (daily, midnight UTC), whose entire job is to POST
a Cloudflare Pages **deploy hook**. That starts a normal Pages build of `main`.

There is no `fetch` handler. The worker is not reachable over HTTP.

## Why it exists

Two pages are built from live remote data *at build time*:

- the events page reads Annie's Google Calendar,
- the reviews gallery reads a Google Drive folder.

Nothing about adding a calendar event or dropping a photo into Drive touches this
repository, so no push happens and Pages has no reason to rebuild. Without a
periodic nudge, Annie's changes would never appear — and the events page would go
stale in a second way, because `src/_data/calendar.js` splits future from past
against `new Date()` at build time. An event that has been and gone stays listed
as upcoming until something rebuilds the site.

This worker is that nudge. A daily cadence means a change is live within 24
hours; when that is too slow, retry the deployment from the Cloudflare dashboard
(the path Annie is given in
[`docs/managing-gallery-photos.md`](../../docs/managing-gallery-photos.md)).

> Historically this worker was built to *receive* a Google Calendar
> `events.watch` webhook and rebuild on demand. That channel expired and was not
> renewed — Calendar push channels are short-lived and need re-registering — so
> it was reduced to a cron. Nothing in the codebase still registers a webhook.

## Deploying

```bash
cd workers/calendar
npm install
npx wrangler deploy
```

The deploy hook URL is hardcoded in `src/index.js`. It carries no auth beyond
being unguessable: **anyone who has the URL can trigger a deploy.** If it ever
needs rotating, create a new hook in the Pages project settings and replace the
URL.

## If it stops

Nothing breaks and nothing looks wrong — the site simply stops picking up
Annie's calendar and Drive changes, and past events keep showing as upcoming.
The only signal is the site quietly going stale, so check here first when Annie
reports that an update "hasn't appeared". Cron invocations are visible in the
Cloudflare dashboard (`observability` is enabled).

## Known cruft

- `@octokit/core` is a declared dependency and is not used.
- `test/index.spec.js` is the generated Hello World scaffold. It calls
  `worker.fetch()`, which does not exist here, so `npm test` fails. Treat it as a
  stub, not as coverage.
