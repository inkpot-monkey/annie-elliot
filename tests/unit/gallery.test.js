import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import gallery from "../../src/_data/gallery.js";

// The seam is the module's `fetch` boundary. Each test stubs `globalThis.fetch`
// to return a fixture Drive `files.list` payload and sets `DRIVE_KEY`; both the
// real fetch and the env are saved/restored around every case so nothing leaks.

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realKey = process.env.DRIVE_KEY;

// Build a fake `Response` with the fields the module reads.
function mockFetch(payload, { ok = true, status = 200, statusText = "OK" } = {}) {
    globalThis.fetch = async () => ({
        ok,
        status,
        statusText,
        json: async () => payload,
    });
}

// A Drive `files.list` entry with sensible defaults.
function file(name, extra = {}) {
    return {
        id: extra.id ?? `id-${name}`,
        name,
        mimeType: extra.mimeType ?? "image/jpeg",
        description: extra.description,
        modifiedTime: extra.modifiedTime ?? "2024-01-01T00:00:00.000Z",
    };
}

beforeEach(() => {
    process.env.DRIVE_KEY = "test-key";
});

afterEach(() => {
    globalThis.fetch = realFetch;
    console.warn = realWarn;
    if (realKey === undefined) {
        delete process.env.DRIVE_KEY;
    } else {
        process.env.DRIVE_KEY = realKey;
    }
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

    const result = await gallery();

    assert.deepEqual(
        result.map((r) => r.caption),
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

    const result = await gallery();

    assert.deepEqual(
        result.map((r) => r.caption),
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

    const result = await gallery();

    // alpha..delta are numbered (parse a prefix); echo has no separator so it
    // is un-numbered and falls to the end.
    assert.deepEqual(
        result.map((r) => r.caption),
        ["alpha", "bravo", "charlie", "delta", "echo"],
    );
});

test("alt = description when present; = cleaned filename when blank; never empty", async () => {
    mockFetch({
        files: [
            file("1 - x.jpg", { description: "My caption" }),
            file("2 - hello-world.jpg", { description: "" }),
            file("3 - a_b.jpg"), // description undefined
        ],
    });

    const result = await gallery();

    assert.equal(result[0].alt, "My caption");
    assert.equal(result[1].alt, "hello world");
    assert.equal(result[2].alt, "a b");
    for (const r of result) {
        assert.ok(r.alt.length > 0, "alt is never empty");
    }
});

test("alt falls back to the raw filename when prefix strips the stem to empty", async () => {
    // Pathological name: prefix + separator + nothing but the extension, blank
    // description. cleaned === "" here, so alt must fall back to the filename.
    mockFetch({ files: [file("01 - .jpg", { description: "" })] });

    const result = await gallery();

    assert.equal(result[0].alt, "01 - .jpg");
    assert.ok(result[0].alt.length > 0, "alt is never empty");
});

test("caption = description verbatim, and '' when blank", async () => {
    mockFetch({
        files: [
            file("1 - x.jpg", { description: "Verbatim caption text." }),
            file("2 - y.jpg", { description: "" }),
            file("3 - z.jpg"), // description undefined
        ],
    });

    const result = await gallery();

    assert.equal(result[0].caption, "Verbatim caption text.");
    assert.equal(result[1].caption, "");
    assert.equal(result[2].caption, "");
});

test("non-image MIME types are filtered out", async () => {
    mockFetch({
        files: [
            file("1 - photo.jpg", { mimeType: "image/jpeg", description: "keep" }),
            file("doc.pdf", { mimeType: "application/pdf" }),
            file("clip.mp4", { mimeType: "video/mp4" }),
        ],
    });

    const result = await gallery();

    assert.equal(result.length, 1);
    assert.equal(result[0].caption, "keep");
});

test("HEIC/HEIF skipped with a console.warn naming the file", async () => {
    const warnings = [];
    console.warn = (msg) => warnings.push(msg);

    mockFetch({
        files: [
            file("a.heic", { mimeType: "image/heic" }),
            file("b.heif", { mimeType: "image/heif" }),
            file("1 - c.jpg", { mimeType: "image/jpeg", description: "kept" }),
        ],
    });

    const result = await gallery();

    assert.equal(result.length, 1);
    assert.equal(result[0].caption, "kept");
    assert.equal(warnings.length, 2);
    assert.ok(warnings.some((w) => w.includes("a.heic")), "warns naming a.heic");
    assert.ok(warnings.some((w) => w.includes("b.heif")), "warns naming b.heif");
});

test("throws when DRIVE_KEY is missing", async () => {
    delete process.env.DRIVE_KEY; // module reads it at call time, even though .env sets it
    mockFetch({ files: [] });

    await assert.rejects(() => gallery(), /DRIVE_KEY/);
});

test("throws on a non-OK files.list response", async () => {
    mockFetch({}, { ok: false, status: 403, statusText: "Forbidden" });

    await assert.rejects(() => gallery(), /403/);
});

test("src is the media URL for the file id with the &v=modifiedTime cache-buster", async () => {
    mockFetch({
        files: [
            file("1 - x.jpg", {
                id: "abc123",
                modifiedTime: "2024-05-01T10:00:00.000Z",
            }),
        ],
    });

    const result = await gallery();
    const { src } = result[0];

    assert.ok(src.includes("files/abc123"), "src targets the file id");
    assert.ok(src.includes("alt=media"), "src is the media (bytes) URL");
    assert.ok(
        src.includes(`v=${encodeURIComponent("2024-05-01T10:00:00.000Z")}`),
        "src carries the modifiedTime cache-buster",
    );
});
