import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import gallery from "../../src/_data/gallery.js";

// The seam is the module's `fetch` boundary. Each test stubs `globalThis.fetch`
// to return a fixture Drive `files.list` payload and sets `GOOGLE_KEY`; both the
// real fetch and the env are saved/restored around every case so nothing leaks.
//
// The row packer is exercised through this same seam rather than imported
// directly: an Eleventy `_data/*.js` module with any named export beside
// `default` is handed to templates as the module namespace instead of the
// default export's value, so the packer has to stay private.

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realGoogleKey = process.env.GOOGLE_KEY;

function restoreEnv(name, saved) {
	if (saved === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = saved;
	}
}

// Build a fake `Response` with the fields the module reads.
function mockFetch(
	payload,
	{ ok = true, status = 200, statusText = "OK" } = {},
) {
	globalThis.fetch = async () => ({
		ok,
		status,
		statusText,
		json: async () => payload,
	});
}

// A Drive `files.list` entry with sensible defaults. Dimensions default to a
// square so cases that are not about ratios need not carry them.
function file(name, extra = {}) {
	const { width = 1000, height = 1000, rotation, ...rest } = extra;
	const id = rest.id ?? `id-${name}`;
	return {
		id,
		name,
		mimeType: rest.mimeType ?? "image/jpeg",
		description: rest.description,
		modifiedTime: rest.modifiedTime ?? "2024-01-01T00:00:00.000Z",
		// The exact string Drive returns, and what mediaSrc() builds the src from.
		webContentLink:
			"webContentLink" in extra
				? extra.webContentLink
				: `https://drive.google.com/uc?id=${id}&export=download`,
		imageMediaMetadata:
			"imageMediaMetadata" in extra
				? extra.imageMediaMetadata
				: { width, height, ...(rotation === undefined ? {} : { rotation }) },
	};
}

// Silence (and collect) the module's warnings.
function captureWarnings() {
	const warnings = [];
	console.warn = (msg) => warnings.push(msg);
	return warnings;
}

beforeEach(() => {
	process.env.GOOGLE_KEY = "test-key";
});

afterEach(() => {
	globalThis.fetch = realFetch;
	console.warn = realWarn;
	restoreEnv("GOOGLE_KEY", realGoogleKey);
});

test("orders by numeric prefix (1/2/10 numeric, not lexical; padding optional)", async () => {
	mockFetch({
		files: [
			file("10 - j.jpg", { description: "j" }),
			file("2 - b.jpg", { description: "b" }),
			file("1 - a.jpg", { description: "a" }),
			file("03 - c.jpg", { description: "c" }),
		],
	});

	const { photos } = await gallery();

	assert.deepEqual(
		photos.map((r) => r.caption),
		["a", "b", "c", "j"],
	);
});

test("un-numbered files sort last, alphabetical by filename", async () => {
	mockFetch({
		files: [
			file("zebra.jpg", { description: "zebra" }),
			file("1 - first.jpg", { description: "first" }),
			file("apple.jpg", { description: "apple" }),
		],
	});

	const { photos } = await gallery();

	assert.deepEqual(
		photos.map((r) => r.caption),
		["first", "apple", "zebra"],
	);
});

test("forgiving separators (- _ . space) parse a prefix; bare 05echo does not", async () => {
	mockFetch({
		files: [
			file("05echo.jpg", { description: "echo" }),
			file("04 delta.jpg", { description: "delta" }),
			file("03.charlie.jpg", { description: "charlie" }),
			file("02_bravo.jpg", { description: "bravo" }),
			file("01 - alpha.jpg", { description: "alpha" }),
		],
	});

	const { photos } = await gallery();

	// alpha..delta are numbered (parse a prefix); echo has no separator so it
	// is un-numbered and falls to the end.
	assert.deepEqual(
		photos.map((r) => r.caption),
		["alpha", "bravo", "charlie", "delta", "echo"],
	);
});

test("caption = description; = cleaned filename when blank; never empty", async () => {
	// One never-empty field, because both <img> tags carry alt="" and the
	// figcaption is the photo's only text alternative.
	mockFetch({
		files: [
			file("1 - x.jpg", { description: "My caption" }),
			file("2 - hello-world.jpg", { description: "" }),
			file("3 - a_b.jpg"), // description undefined
		],
	});

	const { photos } = await gallery();

	assert.equal(photos[0].caption, "My caption");
	assert.equal(photos[1].caption, "hello world");
	assert.equal(photos[2].caption, "a b");
	for (const p of photos) {
		assert.ok(p.caption.length > 0, "caption is never empty");
	}
});

test("caption falls back to the raw filename when prefix strips the stem to empty", async () => {
	// Pathological name: prefix + separator + nothing but the extension, blank
	// description. cleaned === "" here, so the caption must fall back further.
	mockFetch({ files: [file("01 - .jpg", { description: "" })] });

	const { photos } = await gallery();

	assert.equal(photos[0].caption, "01 - .jpg");
});

test("the dead `alt` field is gone — caption is the single text alternative", async () => {
	mockFetch({ files: [file("1 - x.jpg", { description: "Only field." })] });

	const { photos } = await gallery();

	assert.equal(photos[0].alt, undefined);
});

test("non-image MIME types are filtered out", async () => {
	mockFetch({
		files: [
			file("1 - photo.jpg", { mimeType: "image/jpeg", description: "keep" }),
			file("doc.pdf", { mimeType: "application/pdf" }),
			file("clip.mp4", { mimeType: "video/mp4" }),
		],
	});

	const { photos } = await gallery();

	assert.equal(photos.length, 1);
	assert.equal(photos[0].caption, "keep");
});

test("HEIC/HEIF skipped with a console.warn naming the file", async () => {
	const warnings = captureWarnings();

	mockFetch({
		files: [
			file("a.heic", { mimeType: "image/heic" }),
			file("b.heif", { mimeType: "image/heif" }),
			file("1 - c.jpg", { mimeType: "image/jpeg", description: "kept" }),
		],
	});

	const { photos } = await gallery();

	assert.equal(photos.length, 1);
	assert.equal(photos[0].caption, "kept");
	assert.equal(warnings.length, 2);
	assert.ok(
		warnings.some((w) => w.includes("a.heic")),
		"warns naming a.heic",
	);
	assert.ok(
		warnings.some((w) => w.includes("b.heif")),
		"warns naming b.heif",
	);
});

test("throws when no API key is set", async () => {
	// The module reads GOOGLE_KEY at call time; clear it so nothing satisfies it.
	delete process.env.GOOGLE_KEY;
	mockFetch({ files: [] });

	await assert.rejects(() => gallery(), /GOOGLE_KEY/);
});

test("throws on a non-OK files.list response", async () => {
	mockFetch({}, { ok: false, status: 403, statusText: "Forbidden" });

	await assert.rejects(() => gallery(), /403/);
});

test("throws on a 200 that lists no files — a folder gone non-public looks like this", async () => {
	// Drive answers files.list on a folder the key can no longer read with
	// `200 {"files": []}`, and a key consumer cannot even ask permissions.list
	// why. Left unguarded that is a blank gallery on a green build.
	mockFetch({ files: [] });

	await assert.rejects(() => gallery(), /empty/i);
});

test("throws on a 200 with no files key at all", async () => {
	mockFetch({});

	await assert.rejects(() => gallery(), /empty/i);
});

test("src is the file's webContentLink with the &v=modifiedTime cache-buster", async () => {
	mockFetch({
		files: [
			file("1 - x.jpg", {
				id: "abc123",
				modifiedTime: "2024-05-01T10:00:00.000Z",
			}),
		],
	});

	const { photos } = await gallery();
	const { src } = photos[0];

	assert.ok(src.startsWith("https://drive.google.com/uc?id=abc123"));
	assert.ok(
		src.includes(`v=${encodeURIComponent("2024-05-01T10:00:00.000Z")}`),
		"src carries the modifiedTime cache-buster",
	);
});

test("src carries no API key — eleventy-img hashes it into every filename", async () => {
	// The whole point of Fix 2: a key in the src is a key in the name of every
	// rendition in dist/img/, so rotating it renames and re-transcodes the lot.
	mockFetch({ files: [file("1 - x.jpg")] });

	const { photos } = await gallery();

	assert.ok(!photos[0].src.includes("test-key"), "no key value in the src");
	assert.ok(!photos[0].src.includes("key="), "no key parameter at all");
});

test("throws rather than falling back to a key-bearing URL when webContentLink is missing", async () => {
	mockFetch({ files: [file("1 - x.jpg", { webContentLink: undefined })] });

	await assert.rejects(() => gallery(), /webContentLink/);
});

test("requests imageMediaMetadata and webContentLink so both cost no extra call", async () => {
	let requested = "";
	globalThis.fetch = async (url) => {
		requested = decodeURIComponent(url);
		return {
			ok: true,
			status: 200,
			statusText: "OK",
			json: async () => ({ files: [file("1 - x.jpg")] }),
		};
	};

	await gallery();

	assert.match(requested, /imageMediaMetadata\(width,height,rotation\)/);
	assert.match(requested, /webContentLink/);
});

// ---------------------------------------------------------------- ratios (01)

test("ratio is width/height for an unrotated photo", async () => {
	mockFetch({
		files: [
			file("1 - landscape.jpg", { width: 4000, height: 3000 }),
			file("2 - portrait.jpg", { width: 1200, height: 1600 }),
		],
	});

	const { photos } = await gallery();

	assert.equal(photos[0].ratio, 4000 / 3000);
	assert.equal(photos[1].ratio, 0.75);
});

test("an odd EXIF rotation swaps the axes — Drive reports the STORED orientation", async () => {
	// The two live photos in this shape: 4032x3024 stored, rotation 1, displayed
	// portrait. sharp bakes the rotation into the pixels, so the ratio the page
	// lays out against is h/w, not w/h.
	mockFetch({
		files: [
			file("1 - quarter.jpg", { width: 4032, height: 3024, rotation: 1 }),
			file("2 - three-quarter.jpg", { width: 4032, height: 3024, rotation: 3 }),
			file("3 - half.jpg", { width: 4032, height: 3024, rotation: 2 }),
			file("4 - none.jpg", { width: 4032, height: 3024, rotation: 0 }),
		],
	});

	const { photos } = await gallery();

	assert.equal(photos[0].ratio, 3024 / 4032, "rotation 1 swaps");
	assert.equal(photos[1].ratio, 3024 / 4032, "rotation 3 swaps");
	assert.equal(photos[2].ratio, 4032 / 3024, "rotation 2 does not swap");
	assert.equal(photos[3].ratio, 4032 / 3024, "rotation 0 does not swap");
});

test("missing dimensions fall back to 1:1 with a warning, never a build failure", async () => {
	const warnings = captureWarnings();

	mockFetch({
		files: [
			file("1 - no-metadata.jpg", { imageMediaMetadata: undefined }),
			file("2 - empty-metadata.jpg", { imageMediaMetadata: {} }),
			file("3 - zero-height.jpg", { width: 100, height: 0 }),
			file("4 - fine.jpg", { width: 1000, height: 500 }),
		],
	});

	const { photos } = await gallery();

	assert.equal(photos.length, 4, "no photo is dropped");
	assert.equal(photos[0].ratio, 1);
	assert.equal(photos[1].ratio, 1);
	assert.equal(photos[2].ratio, 1);
	assert.equal(photos[3].ratio, 2);
	assert.equal(warnings.length, 3, "one warning per photo without dimensions");
	assert.ok(warnings.every((w) => w.includes("assuming 1:1")));
});

// ---------------------------------------------------------------- packer (02)

// The live gallery's exact ratios, in order.
function liveFiles() {
	return [
		file("01 - Lucinda.jpg", { width: 1200, height: 1600 }), // 0.75
		file("02 - HuntingRaven.jpg", { width: 1200, height: 1600 }), // 0.75
		file("03 - Broadstairs.jpg", { width: 4000, height: 3000 }), // 1.3333
		file("04 - BleakHouse.jpg", { width: 640, height: 481 }), // 1.3306
		file("05 - Bournemouth.jpg", { width: 3000, height: 2000 }), // 1.5
		file("06 - Rochester.jpg", { width: 4000, height: 3000 }), // 1.3333
		file("07 - Lillian.jpg", { width: 4032, height: 3024, rotation: 1 }), // 0.75
		file("08 - GadsHill.jpg", { width: 4032, height: 3024, rotation: 1 }), // 0.75
		file("09 - MuseumLaunch.jpg", { width: 1200, height: 1600 }), // 0.75
		file("Outside museum.jpg", { width: 1200, height: 1600 }), // 0.75
		file("symposium1.png", { width: 1282, height: 736, mimeType: "image/png" }), // 1.7418
	];
}

test("the live eleven pack into 3+2+3+3", async () => {
	mockFetch({ files: liveFiles() });

	const { rows } = await gallery();

	assert.deepEqual(
		rows.map((row) => row.length),
		[3, 2, 3, 3],
	);
});

test("rows partition the photos in order — nothing lost, nothing duplicated", async () => {
	mockFetch({ files: liveFiles() });

	const { photos, rows } = await gallery();

	const flattened = rows.flat();
	assert.equal(flattened.length, photos.length);
	for (const [i, item] of flattened.entries()) {
		assert.equal(
			item,
			photos[i],
			`row item ${i} IS photos[${i}] (same object)`,
		);
		assert.equal(item.index, i, "the flat index is the photo's position");
	}
});

test("a list whose every file is skipped yields no rows rather than throwing", async () => {
	// The packer's empty-input path. It can no longer be reached with an empty
	// files.list — that is now a hard failure — but the soft-skips above still
	// get there, and HEIC-only is the realistic way.
	captureWarnings();
	mockFetch({
		files: [
			file("a.heic", { mimeType: "image/heic" }),
			file("b.heif", { mimeType: "image/heif" }),
		],
	});

	const { photos, rows } = await gallery();

	assert.deepEqual(photos, []);
	assert.deepEqual(rows, []);
});

test("a single photo is a single row", async () => {
	mockFetch({ files: [file("1 - only.jpg", { width: 1200, height: 1600 })] });

	const { rows } = await gallery();

	assert.deepEqual(
		rows.map((row) => row.length),
		[1],
	);
});

test("share is the photo's fraction of its row, and every row's shares sum to 1", async () => {
	mockFetch({ files: liveFiles() });

	const { rows } = await gallery();

	for (const row of rows) {
		const sum = row.reduce((s, item) => s + item.ratio, 0);
		let shareSum = 0;
		for (const item of row) {
			assert.equal(item.share, item.ratio / sum);
			assert.equal(item.rowCount, row.length);
			shareSum += item.share;
		}
		assert.ok(Math.abs(shareSum - 1) < 1e-12, "the row's shares sum to 1");
	}

	// The first row is 0.75 + 0.75 + 1.3333 — spot-check against ticket 03's table.
	assert.equal(rows[0][0].share.toFixed(4), "0.2647");
	assert.equal(rows[3][2].share.toFixed(4), "0.5373");
});
