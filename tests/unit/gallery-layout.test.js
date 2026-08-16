import test from "node:test";
import assert from "node:assert/strict";

import {
	packRows,
	parseFilename,
	SKIP_MIME,
} from "../../src/_lib/gallery-layout.js";

// The site's own presentation layer: nothing here touches Google, the network or
// the clock, so it is tested by calling it. That is the point of the split — the
// packer used to be reachable only through `src/_data/gallery.js`'s `fetch`
// seam, because an Eleventy `_data/*.js` module may export nothing but
// `default`.

// ------------------------------------------------------------ parseFilename

test("a numeric prefix is parsed numerically, not lexically", () => {
	assert.deepEqual(parseFilename("10 - j.jpg"), { order: 10, cleaned: "j" });
	assert.deepEqual(parseFilename("2 - b.jpg"), { order: 2, cleaned: "b" });
	assert.deepEqual(parseFilename("03 - c.jpg"), { order: 3, cleaned: "c" });
});

test("- _ . and space all separate a prefix; a bare 05echo does not", () => {
	assert.equal(parseFilename("01 - alpha.jpg").order, 1);
	assert.equal(parseFilename("02_bravo.jpg").order, 2);
	assert.equal(parseFilename("03.charlie.jpg").order, 3);
	assert.equal(parseFilename("04 delta.jpg").order, 4);
	assert.deepEqual(parseFilename("05echo.jpg"), {
		order: null,
		cleaned: "05echo",
	});
});

test("the extension is stripped and - _ become spaces", () => {
	assert.equal(parseFilename("2 - hello-world.jpg").cleaned, "hello world");
	assert.equal(parseFilename("3 - a_b.jpg").cleaned, "a b");
	assert.equal(parseFilename("Outside museum.jpg").cleaned, "Outside museum");
});

test("a name that is nothing but a prefix cleans to the empty string", () => {
	// The caller has to fall back further — the caption may never be empty.
	assert.deepEqual(parseFilename("01 - .jpg"), { order: 1, cleaned: "" });
});

test("a dotfile keeps its name — lastIndexOf(0) is not an extension", () => {
	assert.equal(parseFilename(".hidden").cleaned, ".hidden");
});

// ---------------------------------------------------------------- SKIP_MIME

test("HEIC and HEIF are the skipped types, and JPEG is not", () => {
	assert.ok(SKIP_MIME.has("image/heic"));
	assert.ok(SKIP_MIME.has("image/heif"));
	assert.ok(!SKIP_MIME.has("image/jpeg"));
});

// ------------------------------------------------------------------ packRows

// The live gallery's exact ratios, in order — the same eleven the fixture build
// lays out, so a change in the packer shows up here before it shows up in a
// visual baseline.
const LIVE_RATIOS = [
	0.75, // 01 - Lucinda.jpg          1200x1600
	0.75, // 02 - HuntingRaven.jpg     1200x1600
	4000 / 3000, // 03 - Broadstairs.jpg      4000x3000
	640 / 481, // 04 - BleakHouse.jpg       640x481
	1.5, // 05 - Bournemouth.jpg      3000x2000
	4000 / 3000, // 06 - Rochester.jpg        4000x3000
	0.75, // 07 - Lillian.jpg          4032x3024 rotation 1
	0.75, // 08 - GadsHill.jpg         4032x3024 rotation 1
	0.75, // 09 - MuseumLaunch.jpg     1200x1600
	0.75, // Outside museum.jpg        1200x1600
	1282 / 736, // symposium1.png            1282x736
];

const items = (ratios) => ratios.map((ratio, index) => ({ ratio, index }));

test("the live eleven pack into 3+2+3+3", () => {
	const rows = packRows(items(LIVE_RATIOS));

	assert.deepEqual(
		rows.map((row) => row.length),
		[3, 2, 3, 3],
	);
});

test("rows partition the input in order — nothing lost, nothing duplicated", () => {
	const photos = items(LIVE_RATIOS);
	const flattened = packRows(photos).flat();

	assert.equal(flattened.length, photos.length);
	for (const [i, item] of flattened.entries()) {
		assert.equal(item, photos[i], `row item ${i} IS photos[${i}]`);
	}
});

test("no input is no rows, rather than a throw", () => {
	assert.deepEqual(packRows([]), []);
});

test("a single photo is a single row", () => {
	assert.deepEqual(
		packRows(items([0.75])).map((row) => row.length),
		[1],
	);
});

test("every row lands within a sane band of the target height", () => {
	// The DP costs EVERY row including the last, which is what keeps the final
	// row flush and near-target instead of ragged. Greedy strands the tail at
	// 0.90-1.31x the target; DP holds 1.00-1.16x on this input.
	const PACK_WIDTH = 1160;
	const ROW_GAP = 8;
	const TARGET_ROW_HEIGHT = 352;

	for (const row of packRows(items(LIVE_RATIOS))) {
		const ratioSum = row.reduce((sum, item) => sum + item.ratio, 0);
		const height = (PACK_WIDTH - ROW_GAP * (row.length - 1)) / ratioSum;
		const factor = height / TARGET_ROW_HEIGHT;
		assert.ok(
			factor > 0.85 && factor < 1.25,
			`row height ${height.toFixed(1)} is ${factor.toFixed(2)}x the target`,
		);
	}
});
