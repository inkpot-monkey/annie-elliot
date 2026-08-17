import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import gallery from "../../src/_data/gallery.js";

// The Eleventy data module: what this SITE does with a normalised Drive folder —
// its skip policy, its caption refinement, its ordering, and the guards it keeps
// that the package deliberately does not.
//
// The transport and normaliser are tested in `@palebluebytes/cms` rather
// than here; the packer has its own direct tests
// (tests/unit/gallery-layout.test.js) — it used to be reachable only through the
// `fetch` seam here, because this module may export nothing but `default`. This
// file still stubs `globalThis.fetch`, since the wrapper is what fixes the
// module's transport, but it is no longer the only way in.

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realGoogleKey = process.env.GOOGLE_KEY;
const realFixtureData = process.env.FIXTURE_DATA;

function restoreEnv(name, saved) {
	if (saved === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = saved;
	}
}

// Build a fake `Response` with the fields the transport reads.
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
	// The fixture branch short-circuits the fetch entirely, so a stray
	// FIXTURE_DATA would quietly bypass every live-path assertion below — the
	// empty-listing hard fail and the webContentLink src most of all — and the
	// suite would still be green.
	delete process.env.FIXTURE_DATA;
});

afterEach(() => {
	globalThis.fetch = realFetch;
	console.warn = realWarn;
	restoreEnv("GOOGLE_KEY", realGoogleKey);
	restoreEnv("FIXTURE_DATA", realFixtureData);
});

// ------------------------------------------------------------------- ordering

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

// -------------------------------------------------------------------- caption

test("caption = description; = cleaned filename when blank; never empty", async () => {
	// One never-empty field, because both <img> tags carry alt="" and the
	// figcaption is the photo's only text alternative. The transport already
	// guarantees non-empty; what this module adds is the tidied filename.
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

// ------------------------------------------------------------- what is shown

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

test("a list whose every file is skipped yields no rows rather than throwing", async () => {
	// The packer's empty-input path. It can no longer be reached with an empty
	// files.list — that is a hard failure below — but the soft-skips still get
	// there, and HEIC-only is the realistic way.
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

test("the site asks Drive for images only — the transport does not", async () => {
	// A stray document in the folder should not cost a listing entry. The
	// transport's base query says nothing about mimeType, so this clause has to
	// come from here.
	let requested;
	globalThis.fetch = async (request) => {
		requested = new URL(request.url);
		return {
			ok: true,
			status: 200,
			statusText: "OK",
			json: async () => ({ files: [file("1 - x.jpg")] }),
		};
	};

	await gallery();

	assert.match(requested.searchParams.get("q"), /mimeType contains 'image\/'/);
});

// ------------------------------------------------------------------- failures

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
	// why. Left unguarded that is a blank gallery on a green build. The guard is
	// this site's, not the transport's: `fetchPhotos` returns [] for an empty
	// folder because "empty" is legal in general, and only this site knows Annie
	// never empties hers.
	mockFetch({ files: [] });

	await assert.rejects(() => gallery(), /empty/i);
});

test("throws on a 200 with no files key at all", async () => {
	mockFetch({});

	await assert.rejects(() => gallery(), /empty/i);
});

// ------------------------------------------------------------------------ src

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
	// A key in the src is a key in the name of every rendition in dist/img/, so
	// rotating it renames and re-transcodes the lot.
	mockFetch({ files: [file("1 - x.jpg")] });

	const { photos } = await gallery();

	assert.ok(!photos[0].src.includes("test-key"), "no key value in the src");
	assert.ok(!photos[0].src.includes("key="), "no key parameter at all");
});

test("throws rather than falling back to a key-bearing URL when webContentLink is missing", async () => {
	mockFetch({ files: [file("1 - x.jpg", { webContentLink: undefined })] });

	await assert.rejects(() => gallery(), /webContentLink/);
});

// ------------------------------------------------------------ rows and shares

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

// ------------------------------------------------------------------- fixtures

test("FIXTURE_DATA reads the checked-in payload through the same normaliser", async () => {
	// No network, and no faked Response — the fixture is a raw files.list body,
	// so it goes straight through normalisePhotos. The src is the only thing that
	// differs from the live path: local files, not Drive URLs.
	process.env.FIXTURE_DATA = "1";
	globalThis.fetch = async () => {
		throw new Error("the fixture path must not touch the network");
	};

	const { photos, rows } = await gallery();

	assert.ok(photos.length > 0, "the fixture folder is not empty");
	assert.ok(rows.length > 0);
	for (const photo of photos) {
		assert.match(photo.src, /^\.\/tests\/fixtures\/gallery-images\//);
		assert.ok(photo.caption.length > 0);
		assert.ok(photo.ratio > 0);
	}
});
