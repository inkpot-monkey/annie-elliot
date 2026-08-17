/**
 * The gallery's presentation rules: which files this site shows, what it calls
 * them, and how they pack into justified rows.
 *
 * All of this is annie-elliot's, not Google's — which is why it stayed here when
 * the Drive half left for `@palebluebytes/cms`. Pure: no network, no
 * clock, no environment.
 */

// HEIC/HEIF skipped by default (browser + CI-decode risk). A site policy:
// `@palebluebytes/cms/files/google` returns every mimeType and filters
// none of them, deliberately.
export const SKIP_MIME = new Set(["image/heic", "image/heif"]);

// Leading digits + one separator (- _ . or space). Bare "01name" = no prefix.
const PREFIX_RE = /^(\d+)\s*[-_. ]\s*(.*)$/;

// The desktop container: --grid-max-width (77.5rem) less 2 x --grid-gutter
// (2.5rem at that size) = 72.5rem = 1160px at a 16px root. Row BREAKS are frozen
// at this width; the widths themselves stay fluid (each row is a flex container
// whose items carry `flex: var(--r) 1 0`), so rows remain flush and uncropped at
// every container width — measured 647-1240px in the ticket-02 prototype.
//
// These three are duplicated in src/reviews.webc and tests/gallery.spec.js on
// purpose — see AGENTS.md, "Gallery geometry is duplicated across three layers".
const PACK_WIDTH = 1160;
const TARGET_ROW_HEIGHT = 352; // 22rem
const ROW_GAP = 8; // 0.5rem — must track the gallery's --gap in reviews.webc

/**
 * Annie's ordering convention, read off the filename: an optional numeric
 * prefix, and a stem tidied into something readable enough to be a caption.
 *
 * @param {string} name
 * @returns {{order: number|null, cleaned: string}}
 */
export function parseFilename(name) {
	const dot = name.lastIndexOf(".");
	const base = dot > 0 ? name.slice(0, dot) : name; // strip extension
	const m = base.match(PREFIX_RE);
	const order = m ? parseInt(m[1], 10) : null;
	const stem = m ? m[2] : base;
	const cleaned = stem.replace(/[-_]+/g, " ").trim(); // "cleaned filename"
	return { order, cleaned };
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
 *
 * @param {{ratio: number}[]} items
 * @returns {{ratio: number}[][]} The same objects, grouped — never copies.
 */
export function packRows(items) {
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
