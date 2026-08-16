import dotenv from "dotenv";
import { readFile } from "node:fs/promises";
import { apiKey } from "../_lib/google-auth.js";
import { fetchPhotos, normalisePhotos } from "../_lib/google-drive.js";
import { packRows, parseFilename, SKIP_MIME } from "../_lib/gallery-layout.js";

dotenv.config();

// This module exports ONLY `default`, and now does so by construction: an
// Eleventy `_data/*.js` module with any other export is handed to templates as
// the whole module namespace, so `$data.gallery` silently becomes
// `{default, packRows}` and every loop renders "[object Object]". Everything
// worth naming lives in `src/_lib/` and is imported here.

// Public folder id — not secret (it's in every share URL). Mirrors calendar.js's
// hard-coded calendarId. Verified live in ticket 05.
const FOLDER_ID = "1yPcvB5KwY7XdKJN2jTyEmGfErgGagmFD";

/**
 * Every photo in the folder, normalised. Under FIXTURE_DATA it comes from a
 * checked-in payload instead of the live Drive folder, so the visual baselines
 * stop drifting every time Annie adds a photo (see
 * tests/fixtures/drive-files.json).
 *
 * Only the FETCH is swapped — the fixture goes through the same normaliser the
 * live path runs, so ratios, the rotation swap and the caption fallback are all
 * still exercised, and there is no `Response` to fake.
 */
async function load() {
	if (process.env.FIXTURE_DATA) {
		return normalisePhotos(
			JSON.parse(
				await readFile(
					new URL("../../tests/fixtures/drive-files.json", import.meta.url),
					"utf8",
				),
			),
		);
	}

	// One Google API key serves both the Drive (gallery) and Calendar APIs — they
	// share a Google Cloud project, so GOOGLE_KEY is the single key for both here
	// and in calendar.js. The key is read HERE and passed in: `_lib/google-drive.js`
	// reads no environment.
	if (!process.env.GOOGLE_KEY) {
		throw new Error("GOOGLE_KEY not found in environment variables");
	}

	const photos = await fetchPhotos({
		folderId: FOLDER_ID,
		auth: apiKey(process.env.GOOGLE_KEY),
	});

	// `res.ok` is not enough, and neither is an empty list. Drive answers a
	// files.list against a folder this key can no longer read with
	// `200 {"files": []}` — a sharing change reads as a successful request that
	// found nothing, and the build would go green with a blank gallery. An
	// API-key consumer cannot even diagnose it: permissions.list rejects API keys
	// outright ("API keys are not supported by this API").
	//
	// A zero-length list is ambiguous in principle — Annie could have emptied the
	// folder — which is why `fetchPhotos` returns `[]` rather than throwing. Only
	// this site knows she never does, so the hard fail lives here.
	if (!photos.length) {
		throw new Error(
			`Drive gallery listing came back empty (HTTP 200). The folder ` +
				`${FOLDER_ID} is either empty or no longer shared with "Anyone with ` +
				`the link"; a 200 with no files is what a sharing change looks like.`,
		);
	}

	return photos;
}

/**
 * What eleventy-img is pointed at. Fixture photos are files in the repo, so they
 * resolve to a path rather than a Drive media URL — the transcode pipeline treats
 * both the same.
 *
 * The src MUST NOT carry the API key. eleventy-img hashes the raw source string
 * into every output filename (`image.js` getHash() — identical bytes at
 * `?key=AAA` and `?key=BBB` produce different filenames), so a key in the URL is
 * a key in the name of every rendition in dist/img/, and rotating it renames and
 * re-transcodes the whole gallery.
 *
 * Drive's own `webContentLink` avoids that: it is credential-free, permanent,
 * deterministic from the file id, and serves the byte-identical original, which
 * is exactly what eleventy-img wants. It is public-link-only — it ignores an
 * Authorization header entirely — which is fine because this folder is public
 * and the API-key listing above already depends on that.
 *
 * One thing this URL does NOT do is fail when the file is unreadable: a
 * non-public id answers `200 text/html` with ~900 KB of sign-in page, and
 * eleventy-fetch throws only on `!res.ok`, so it caches that as image bytes.
 * Not guarded here, deliberately. The folder-level case — the one that would
 * otherwise go green — is caught by the empty-listing check above, and the
 * residual per-file case is already loud: sharp cannot decode HTML, so the
 * build dies (on a poisoned .cache/ entry — clear it before retrying). Catching
 * it here would mean fetching every photo's bytes ourselves at build time,
 * which is both a second download of the whole gallery and the exact traffic
 * shape that trips Google's IP-scoped anti-abuse throttle on media downloads.
 */
function mediaSrc(photo) {
	if (process.env.FIXTURE_DATA) {
		return `./tests/fixtures/gallery-images/${photo.name}`;
	}

	if (!photo.url) {
		// Drive populates webContentLink for any file with binary content, so its
		// absence means the field was dropped from the listing's `fields=` or the
		// file is not what we think it is. Falling back to the key-bearing media
		// URL would silently reintroduce the hash hazard for one photo, which is
		// worse than stopping.
		throw new Error(
			`No webContentLink for Drive file ${photo.name} (${photo.id}) — ` +
				`check the fields= list in _lib/google-drive.js.`,
		);
	}

	// Remote src: eleventy-img fetches+caches+transcodes.
	// modifiedTime = cache-buster; Drive ignores the extra parameter.
	return `${photo.url}&v=${encodeURIComponent(photo.modifiedTime)}`;
}

export default async function () {
	const photos = (await load())
		.filter((photo) => photo.mimeType?.startsWith("image/"))
		.filter((photo) => {
			// A site policy, not Google's: _lib/google-drive.js returns every
			// mimeType and filters none of them.
			if (SKIP_MIME.has(photo.mimeType)) {
				console.warn(
					`[gallery] skipping HEIC (re-export as JPEG): ${photo.name}`,
				);
				return false; // soft-skip, no build failure
			}
			return true;
		})
		.map((photo) => {
			const { order, cleaned } = parseFilename(photo.name);
			return {
				id: photo.id,
				// ONE never-empty field. The Drive description is the photo's text
				// alternative (ticket 05), rendered once as the figcaption — both
				// <img> tags carry alt="", which is only safe if a figcaption always
				// exists to be that alternative. `photo.caption` is already
				// non-empty (`description || name`); this refines its filename half
				// into something readable, which is a convention of this site's and
				// not of Drive's.
				caption: photo.description || cleaned || photo.caption,
				ratio: photo.ratio,
				src: mediaSrc(photo),
				_order: order,
				_name: photo.name,
			};
		})
		// Numbered first (ascending); prefix-less fall to the end, alpha by filename.
		.sort((a, b) => {
			if (a._order != null && b._order != null) return a._order - b._order;
			if (a._order != null) return -1;
			if (b._order != null) return 1;
			return a._name.localeCompare(b._name);
		})
		.map(({ _order, _name, ...item }, index) => ({ ...item, index }));

	const rows = packRows(photos);

	// `share` is the fraction of its row's width the photo occupies and `rowCount`
	// how many photos share that row — together the input to the per-item `sizes`
	// strings composed in reviews.webc. `rowRatioSum` feeds the row's degenerate-
	// gallery width cap. All three are set here because only the packer knows the
	// row, and because a nested `webc:for` does not keep the outer loop's variable
	// in scope for a descendant's attributes; the breakpoint constants stay in the
	// template, next to the CSS that defines them.
	for (const row of rows) {
		const ratioSum = row.reduce((total, item) => total + item.ratio, 0);
		for (const item of row) {
			item.share = item.ratio / ratioSum;
			item.rowCount = row.length;
			item.rowRatioSum = ratioSum;
		}
	}

	// `rows` (grouped, for the mosaic) and `photos` (flat, for the lightbox and
	// the #photo-N anchors) hold the SAME objects.
	return { photos, rows };
}
