import dotenv from "dotenv";
import { readFile } from "node:fs/promises";

dotenv.config();

// Public folder id — not secret (it's in every share URL). Mirrors calendar.js's
// hard-coded calendarId. Verified live in ticket 05.
const FOLDER_ID = "1yPcvB5KwY7XdKJN2jTyEmGfErgGagmFD";

// HEIC/HEIF skipped by default (browser + CI-decode risk).
const SKIP_MIME = new Set(["image/heic", "image/heif"]);

// Leading digits + one separator (- _ . or space). Bare "01name" = no prefix.
const PREFIX_RE = /^(\d+)\s*[-_. ]\s*(.*)$/;

// The desktop container: --grid-max-width (77.5rem) less 2 x --grid-gutter
// (2.5rem at that size) = 72.5rem = 1160px at a 16px root. Row BREAKS are frozen
// at this width; the widths themselves stay fluid (each row is a flex container
// whose items carry `flex: var(--r) 1 0`), so rows remain flush and uncropped at
// every container width — measured 647-1240px in the ticket-02 prototype.
const PACK_WIDTH = 1160;
const TARGET_ROW_HEIGHT = 352; // 22rem
const ROW_GAP = 8; // 0.5rem — must track the gallery's --gap in reviews.webc

function parseFilename(name) {
	const dot = name.lastIndexOf(".");
	const base = dot > 0 ? name.slice(0, dot) : name; // strip extension
	const m = base.match(PREFIX_RE);
	const order = m ? parseInt(m[1], 10) : null;
	const stem = m ? m[2] : base;
	const cleaned = stem.replace(/[-_]+/g, " ").trim(); // "cleaned filename"
	return { order, cleaned };
}

/**
 * The aspect ratio the photo is *displayed* at, once eleventy-img/sharp has
 * baked EXIF orientation into the pixels (it does, and then strips the tag —
 * verified empirically in ticket 01).
 *
 * Drive's imageMediaMetadata width/height are the STORED orientation and
 * `rotation` is quarter-turns clockwise, so an odd rotation swaps the axes.
 * Missing dimensions fall back to 1:1 with a warning: never fail the build and
 * never drop a photo Annie has just uploaded.
 */
function displayRatio(meta, name) {
	const w = meta?.width;
	const h = meta?.height;

	if (!w || !h) {
		console.warn(
			`[gallery] no image dimensions from Drive, assuming 1:1: ${name}`,
		);
		return 1;
	}

	const swap = (meta.rotation ?? 0) % 2 !== 0;
	return swap ? h / w : w / h;
}

/**
 * Justified-row packing (the Flickr/Google-Photos shape), O(n²) DP — 121
 * iterations for 11 photos. Minimises the sum of squared log-deviation of each
 * row's height from the target, log so "twice too tall" and "half as tall" cost
 * the same. Every row is costed INCLUDING the last, which is what makes the
 * final row come out flush and near-target instead of ragged — the map's
 * "stretch the last row, clamped to 1.5x" rule then never has to fire.
 *
 * Greedy was tried in the prototype and is worse: it commits to a locally-good
 * row that strands the tail (3+2+4+2, spread 0.90-1.31x, against DP's 3+2+3+3
 * at 1.00-1.16x).
 */
// NOT exported. An Eleventy `_data/*.js` module with any named export beside
// `default` is handed to templates as the whole module namespace rather than the
// default export's value — silently, so `$data.gallery` becomes
// `{default, packRows}` and every loop renders "[object Object]". The packer is
// covered through this module's public seam in tests/unit/gallery.test.js.
function packRows(items) {
	const count = items.length;

	// The height a row of items[from..to) would take at the packing width.
	const rowHeight = (from, to) => {
		let ratioSum = 0;
		for (let k = from; k < to; k++) ratioSum += items[k].ratio;
		return (PACK_WIDTH - ROW_GAP * (to - from - 1)) / ratioSum;
	};

	const costTo = new Array(count + 1).fill(Infinity);
	const rowStart = new Array(count + 1).fill(-1);
	costTo[0] = 0;

	for (let to = 1; to <= count; to++) {
		for (let from = 0; from < to; from++) {
			if (costTo[from] === Infinity) continue;
			const deviation = Math.log(rowHeight(from, to) / TARGET_ROW_HEIGHT);
			const cost = costTo[from] + deviation * deviation;
			if (cost < costTo[to]) {
				costTo[to] = cost;
				rowStart[to] = from;
			}
		}
	}

	const rows = [];
	for (let to = count; to > 0; to = rowStart[to])
		rows.unshift(items.slice(rowStart[to], to));
	return rows; // empty input -> [] (the reconstruction loop never runs)
}

/**
 * The raw files.list payload. Under FIXTURE_DATA it comes from a checked-in file
 * instead of the live Drive folder, so the visual baselines stop drifting every
 * time Annie adds a photo (see tests/fixtures/drive-files.json). Only the fetch
 * is swapped: the filtering, ordering, ratio and packing below all still run.
 */
async function listFiles() {
	if (process.env.FIXTURE_DATA) {
		return JSON.parse(
			await readFile(
				new URL("../../tests/fixtures/drive-files.json", import.meta.url),
				"utf8",
			),
		);
	}

	// One Google API key serves both the Drive (gallery) and Calendar APIs — they
	// share a Google Cloud project, so GOOGLE_KEY is the single key for both here
	// and in calendar.js.
	const apiKey = process.env.GOOGLE_KEY;

	if (!apiKey) {
		throw new Error("GOOGLE_KEY not found in environment variables");
	}

	const q = `'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`;
	const url =
		`https://www.googleapis.com/drive/v3/files` +
		`?q=${encodeURIComponent(q)}` +
		// imageMediaMetadata rides along on the same call with only the API key,
		// so build-time aspect ratios cost no extra request.
		`&fields=${encodeURIComponent("files(id,name,description,mimeType,modifiedTime,imageMediaMetadata(width,height,rotation))")}` +
		`&orderBy=name&pageSize=1000&key=${apiKey}`;

	const res = await fetch(url);

	if (!res.ok) {
		// Hard-fail, like calendar.js.
		throw new Error(
			`Failed to list Drive gallery: ${res.status} ${res.statusText}`,
		);
	}

	return res.json();
}

/**
 * What eleventy-img is pointed at. Fixture photos are files in the repo, so they
 * resolve to a path rather than a Drive media URL — the transcode pipeline treats
 * both the same.
 */
function mediaSrc(file, apiKey) {
	if (process.env.FIXTURE_DATA) {
		return `./tests/fixtures/gallery-images/${file.name}`;
	}

	// Remote src: eleventy-img fetches+caches+transcodes.
	// modifiedTime = cache-buster.
	return (
		`https://www.googleapis.com/drive/v3/files/${file.id}` +
		`?alt=media&key=${apiKey}&v=${encodeURIComponent(file.modifiedTime)}`
	);
}

export default async function () {
	const { files = [] } = await listFiles();

	const photos = files
		.filter((f) => f.mimeType?.startsWith("image/"))
		.filter((f) => {
			if (SKIP_MIME.has(f.mimeType)) {
				console.warn(`[gallery] skipping HEIC (re-export as JPEG): ${f.name}`);
				return false; // soft-skip, no build failure
			}
			return true;
		})
		.map((f) => {
			const { order, cleaned } = parseFilename(f.name);
			const description = (f.description || "").trim();
			// ONE never-empty field. The Drive description is the photo's text
			// alternative (ticket 05), rendered once as the figcaption — both
			// <img> tags carry alt="", which is only safe if a figcaption always
			// exists to be that alternative. Falling back to the cleaned filename
			// is a poor caption, but it is visible to Annie on the page in a way
			// a silent alt never was.
			return {
				id: f.id,
				caption: description || cleaned || f.name,
				ratio: displayRatio(f.imageMediaMetadata, f.name),
				src: mediaSrc(f, process.env.GOOGLE_KEY),
				_order: order,
				_name: f.name,
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
