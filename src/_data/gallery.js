import dotenv from "dotenv";

dotenv.config();

// Public folder id — not secret (it's in every share URL). Mirrors calendar.js's
// hard-coded calendarId. Verified live in ticket 05.
const FOLDER_ID = "1yPcvB5KwY7XdKJN2jTyEmGfErgGagmFD";

// HEIC/HEIF skipped by default (browser + CI-decode risk).
const SKIP_MIME = new Set(["image/heic", "image/heif"]);

// Leading digits + one separator (- _ . or space). Bare "01name" = no prefix.
const PREFIX_RE = /^(\d+)\s*[-_. ]\s*(.*)$/;

function parseFilename(name) {
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name; // strip extension
    const m = base.match(PREFIX_RE);
    const order = m ? parseInt(m[1], 10) : null;
    const stem = m ? m[2] : base;
    const cleaned = stem.replace(/[-_]+/g, " ").trim(); // "cleaned filename"
    return { order, cleaned };
}

export default async function () {
    const apiKey = process.env.DRIVE_KEY;

    if (!apiKey) {
        throw new Error("DRIVE_KEY not found in environment variables");
    }

    const q = `'${FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`;
    const url =
        `https://www.googleapis.com/drive/v3/files` +
        `?q=${encodeURIComponent(q)}` +
        `&fields=${encodeURIComponent("files(id,name,description,mimeType,modifiedTime)")}` +
        `&orderBy=name&pageSize=1000&key=${apiKey}`;

    const res = await fetch(url);

    if (!res.ok) {
        // Hard-fail, like calendar.js.
        throw new Error(
            `Failed to list Drive gallery: ${res.status} ${res.statusText}`,
        );
    }

    const { files = [] } = await res.json();

    return files
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
            // caption = description verbatim ("" if blank);
            // alt = description, else cleaned filename, else the raw filename —
            // never empty (axe stays green even for a pathological name like "01 - .jpg").
            return {
                id: f.id,
                alt: description || cleaned || f.name,
                caption: description,
                // Remote src: eleventy-img fetches+caches+transcodes.
                // modifiedTime = cache-buster.
                src:
                    `https://www.googleapis.com/drive/v3/files/${f.id}` +
                    `?alt=media&key=${apiKey}&v=${encodeURIComponent(f.modifiedTime)}`,
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
        .map(({ _order, _name, ...item }) => item); // emit only {id, alt, caption, src}
}
