/**
 * Reading a folder of photos out of Google Drive: the transport, and the pure
 * normaliser that turns its payload into something a page can lay out.
 *
 * Nothing here knows about annie-elliot. No environment reads, no filtering by
 * MIME type, no ordering, no packing — those are the site's, and they live in
 * `gallery-layout.js` and `src/_data/gallery.js`. Shaped to leave this repo as
 * one subpath of a package later; the design notes are untracked, under
 * `.scratch/google-data-package/`.
 */

// Everything the gallery needs, in one call. `imageMediaMetadata` rides along
// with only an API key, so build-time aspect ratios cost no extra request, and
// `webContentLink` comes along for the same price.
const BASE_FIELDS = [
	"id",
	"name",
	"description",
	"mimeType",
	"modifiedTime",
	"webContentLink",
	"imageMediaMetadata(width,height,rotation)",
];

// The API's ceiling is 1000. A folder larger than that would need the
// nextPageToken walk `google-calendar.js` does; this one does not have it yet.
const PAGE_SIZE = 1000;

/**
 * A photo, as this module hands it over.
 *
 * @typedef {object} Photo
 * @property {string} id Drive file id.
 * @property {string} name Filename, extension included, exactly as Drive has it.
 * @property {string} mimeType Returned, never filtered on.
 * @property {string} modifiedTime RFC3339 — the only cache-busting input a
 *   consumer needs.
 * @property {string} description Drive's field, trimmed; `""` when unset.
 * @property {string} caption Never empty: `description || name`.
 * @property {number|null} width DISPLAYED pixels; `null` with no metadata.
 * @property {number|null} height DISPLAYED pixels; `null` with no metadata.
 * @property {number} ratio DISPLAYED width/height; 1 when dimensions are missing.
 * @property {number} rotation Quarter-turns clockwise as Drive reported them.
 * @property {string|undefined} url `webContentLink`.
 */

/**
 * @typedef {object} DriveOptions
 * @property {string} folderId
 * @property {import("./google-auth.js").Auth} auth Required.
 * @property {typeof fetch} [fetch] Defaults to the global. The integration-test
 *   seam; unit tests should reach for `normalisePhotos` instead and skip the
 *   network entirely.
 * @property {string[]} [extraFields] MERGED into the field list, never replacing
 *   it.
 * @property {string} [extraQuery] AND-ed onto the base `q`, never replacing it.
 */

/**
 * The raw `files.list` payload. Network, no interpretation.
 *
 * `orderBy=name` is set for a deterministic walk — that is transport
 * correctness, not presentation. The returned order carries no meaning and
 * callers sort.
 *
 * @param {DriveOptions} options
 * @returns {Promise<{files?: object[]}>}
 */
export async function listFiles({
	folderId,
	auth,
	fetch: fetchImpl = globalThis.fetch,
	extraFields = [],
	extraQuery,
}) {
	if (typeof auth !== "function") {
		throw new Error(
			"listFiles needs an `auth` — pass apiKey(key) from ./google-auth.js, " +
				"or any function from Request to authorised Request.",
		);
	}

	// The folder and the trash are all this module decides. WHICH files a caller
	// wants — images only, a name pattern — is the caller's, and it arrives as
	// `extraQuery`: AND-ed on, never replacing, so nothing here can be lost by
	// asking for more. (`@localnerve/google-drive-folder`'s `fileQuery` replaces
	// its own `trashed = false` default; that trap is worth not reproducing.)
	const clauses = [`'${folderId}' in parents`, "trashed = false"];
	if (extraQuery) clauses.push(`(${extraQuery})`);

	const params = new URLSearchParams({
		q: clauses.join(" and "),
		fields: `files(${[...BASE_FIELDS, ...extraFields].join(",")})`,
		orderBy: "name",
		pageSize: String(PAGE_SIZE),
	});

	const request = await auth(
		new Request(`https://www.googleapis.com/drive/v3/files?${params}`),
	);
	const res = await fetchImpl(request);

	if (!res.ok) {
		throw new Error(
			`Failed to list Drive files: ${res.status} ${res.statusText}`,
		);
	}

	return res.json();
}

/**
 * The aspect ratio the photo is *displayed* at, once a transcoder has baked EXIF
 * orientation into the pixels (sharp does, and then strips the tag).
 *
 * Drive's `imageMediaMetadata` width/height are the STORED orientation and
 * `rotation` is quarter-turns clockwise, so an ODD rotation swaps the axes.
 * Missing dimensions fall back to 1:1 with a warning rather than an error: never
 * fail a build, and never drop a photo, over metadata Google chose not to send.
 */
function displayDimensions(meta, name) {
	const w = meta?.width;
	const h = meta?.height;

	if (!w || !h) {
		console.warn(
			`[google-drive] no image dimensions from Drive, assuming 1:1: ${name}`,
		);
		// `width`/`height` stay null while `ratio` does not: a fabricated pixel
		// count is a lie a consumer cannot detect, whereas a stated 1:1 fallback
		// is something it can lay out against.
		return { width: null, height: null, ratio: 1 };
	}

	const swap = (meta.rotation ?? 0) % 2 !== 0;
	const width = swap ? h : w;
	const height = swap ? w : h;
	return { width, height, ratio: width / height };
}

/**
 * Pure. Raw payload in, `Photo[]` out — no network, no clock, no environment.
 * This is the seam a caller feeds checked-in JSON through, which is why the
 * fixture path needs no faked `Response`.
 *
 * @param {{files?: object[]}} payload
 * @returns {Photo[]}
 */
export function normalisePhotos(payload) {
	return (payload?.files ?? []).map((file) => {
		const description = (file.description || "").trim();
		return {
			id: file.id,
			name: file.name,
			mimeType: file.mimeType,
			modifiedTime: file.modifiedTime,
			description,
			// Guaranteed non-empty, so a consumer can render alt="" and let a
			// figcaption be the text alternative. Refining the filename into
			// something prettier is a site convention, not this module's.
			caption: description || file.name,
			...displayDimensions(file.imageMediaMetadata, file.name),
			rotation: file.imageMediaMetadata?.rotation ?? 0,
			// Credential-free, permanent, deterministic from the file id, and
			// serves the byte-identical original — but it resolves only for
			// PUBLICLY SHARED files. A caller reading a private folder with a
			// service account gets this field populated and it answers
			// `200 text/html` with a sign-in page.
			url: file.webContentLink,
		};
	});
}

/**
 * `listFiles` + `normalisePhotos`, so a caller can do the whole thing in a
 * single expression.
 *
 * Returns `[]` for an empty folder rather than throwing. `200 {"files": []}` is
 * exactly what a folder that stopped being shared looks like — but "empty" is
 * also legal, and only the caller knows which its folder can be. See
 * `src/_data/gallery.js`, which knows Annie never empties hers.
 *
 * @param {DriveOptions} options
 * @returns {Promise<Photo[]>}
 */
export async function fetchPhotos(options) {
	return normalisePhotos(await listFiles(options));
}
