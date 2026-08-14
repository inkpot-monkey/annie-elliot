# contact worker

Receives the site's contact form and emails it to Annie.

Deployed to **`contact.annieelliot.co.uk`** as a Cloudflare Worker, independently
of the main site.

## What it does

The form in `src/contact.webc` posts directly to this worker:

```html
<form action="https://contact.annieelliot.co.uk" method="post">
```

On a valid POST it builds a MIME message with `mimetext`, sends it through the
Cloudflare Email binding, and answers with a **303 redirect** back to
`/email-success` or `/email-failure` on the main site.

| | |
| --- | --- |
| From | `info@annieelliot.co.uk` |
| To | `author.annie.elliot@gmail.com` |
| Subject | `A message from <the sender's address>` |
| `Reply-To` | the sender's address, when it looks like one |

Requests are rejected with **403** unless `Origin` or `Referer` starts with
`https://annieelliot.co.uk`, and with **405** unless the method is POST.

## Why it works this way

The site ships no JavaScript, so there is no `fetch()` to post the form and
handle a JSON response. It is a plain HTML form submit, which navigates. That is
why the worker answers with a 303 to a real page rather than a status code —
`/email-success/` and `/email-failure/` are ordinary Eleventy pages that exist to
be redirect targets.

The `Reply-To` header is what makes replying work: the mail is *sent* by
`info@annieelliot.co.uk` because Cloudflare Email Routing will only send as a
verified address, so the visitor's address has to travel in `Reply-To` instead of
`From`.

## Deploying

```bash
cd workers/contact
npm install
npx wrangler deploy
```

There are no secrets. The `send_email` binding named `EMAIL` is declared in
`wrangler.jsonc`, and both the sender and recipient addresses must be verified in
**Cloudflare → Email Routing**.

## If it stops

The contact page still renders and the form still submits — visitors get a
worker error page instead of `/email-success/`, and **the message is lost
silently**. Nothing on the main site monitors this, and no copy of the message is
stored anywhere. Worker logs are in the Cloudflare dashboard (`observability` is
enabled).

## Tests

`test/index.spec.js` is **still the generated Hello World scaffold** and does not
test this worker — it asserts the response body is `"Hello World!"`, which it
never is. `npm test` fails. Treat the file as a stub to be replaced, not as
coverage.
