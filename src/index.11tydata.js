import path from "node:path";
import Image from "@11ty/eleventy-img";

/** Must match `sizes` on the book cover in `index.webc`. */
const LCP_SIZES =
  "(min-width: 60rem) min(34rem, 42vw), calc(100vw - 3rem)";

/**
 * Must match the cover `<eleventy-image>` in `index.webc` and `eleventyImagePlugin` in `eleventy.config.js`
 * so URLs line up with the in-memory cache.
 */
function bookCoverImageOptions(outputDir) {
  return {
    widths: [400, 640, 800, 1000],
    formats: ["webp", "jpeg"],
    urlPath: "/img/",
    outputDir,
    sharpWebpOptions: {
      quality: 78,
      effort: 5,
    },
    sharpJpegOptions: {
      quality: 78,
      mozjpeg: true,
    },
  };
}

export default {
  eleventyComputed: {
    lcpBookCoverPreload: async (data) => {
      const inputDir = data.eleventy.directories.input;
      const outputDirRoot = data.eleventy.directories.output;
      const src = path.join(inputDir, "static/images/book-cover.jpg");
      const imgOutputDir = path.join(outputDirRoot, "img");

      const metadata = await Image(src, bookCoverImageOptions(imgOutputDir));

      const webp = metadata.webp;
      if (!webp?.length) {
        return undefined;
      }

      const imagesrcset = webp.map((e) => `${e.url} ${e.width}w`).join(", ");
      const href =
        webp.find((e) => e.width === 640)?.url ?? webp[webp.length - 1].url;

      return {
        href,
        imagesrcset,
        imagesizes: LCP_SIZES,
      };
    },
  },
};
