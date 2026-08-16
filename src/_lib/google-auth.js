/**
 * How a Google request gets its credential.
 *
 * THE SEAM: auth is ONE type — a function taking a `Request` and returning an
 * authorised `Request`. Every model reduces to it, including models this file
 * does not implement (a bearer token, a service-account JWT): a caller with its
 * own credential machinery passes its own function and never touches `apiKey`.
 *
 * A `Request` rather than `(url, init)` because it is the one
 * credential-carrying object present in every runtime this code is meant to run
 * in — Node 18+, Deno, Bun, Workers — and it holds url and headers together, so
 * an implementation can put the credential in either.
 *
 * This module reads no environment variables. `process.env` does not exist on
 * every target runtime, and an env var read down inside a data layer is
 * invisible coupling; the key is passed in from `src/_data/`, where `.env` is
 * loaded.
 *
 * Shaped to leave this repo as one subpath of a package later; the design notes
 * are untracked, under `.scratch/google-data-package/`.
 *
 * @typedef {(request: Request) => Request | Promise<Request>} Auth
 */

/**
 * Credential in the query string (`?key=`). The only model Google's public-data
 * endpoints accept without OAuth, and the only one this site uses.
 *
 * Its hazard, which callers have to know: an API key can only ever read PUBLIC
 * content, and it cannot check its own access — `permissions.list` rejects API
 * keys outright ("API keys are not supported by this API"). So a folder that
 * stops being shared answers `200 {"files": []}` rather than a 403, and only the
 * caller knows whether an empty folder is plausible.
 *
 * @param {string} key
 * @returns {Auth}
 */
export function apiKey(key) {
	if (!key) {
		// Fail here rather than sending `?key=undefined`, which Google answers
		// with a 400 that says nothing about where the credential should have
		// come from.
		throw new Error("apiKey(key) needs a non-empty Google API key");
	}

	return (request) => {
		const url = new URL(request.url);
		url.searchParams.set("key", key);
		// `new Request(url, request)` copies method, headers and body across.
		return new Request(url, request);
	};
}
