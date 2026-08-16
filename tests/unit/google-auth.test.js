import test from "node:test";
import assert from "node:assert/strict";

import { apiKey } from "../../src/_lib/google-auth.js";

// One type: an `Auth` is a function from Request to Request. Everything else in
// this file is a consequence of that.

test("the key rides in the query string", async () => {
	const authed = await apiKey("secret")(
		new Request("https://www.googleapis.com/drive/v3/files?q=whatever"),
	);

	const url = new URL(authed.url);
	assert.equal(url.searchParams.get("key"), "secret");
	assert.equal(url.searchParams.get("q"), "whatever", "the rest survives");
});

test("the request's method and headers survive authorisation", async () => {
	const authed = await apiKey("secret")(
		new Request("https://www.googleapis.com/drive/v3/files", {
			headers: { accept: "application/json" },
		}),
	);

	assert.equal(authed.method, "GET");
	assert.equal(authed.headers.get("accept"), "application/json");
});

test("a missing key throws at construction, not on the first request", async () => {
	// The alternative is `?key=undefined`, which Google answers with a 400 that
	// says nothing about where the credential should have come from.
	assert.throws(() => apiKey(undefined), /key/i);
	assert.throws(() => apiKey(""), /key/i);
});

test("the same Auth authorises repeated requests", async () => {
	const auth = apiKey("secret");
	const one = await auth(new Request("https://example.test/a"));
	const two = await auth(new Request("https://example.test/b"));

	assert.equal(new URL(one.url).searchParams.get("key"), "secret");
	assert.equal(new URL(two.url).searchParams.get("key"), "secret");
});
