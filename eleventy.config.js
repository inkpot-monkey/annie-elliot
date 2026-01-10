import pluginWebc from "@11ty/eleventy-plugin-webc";
import { eleventyImagePlugin } from "@11ty/eleventy-img";
import dotenv from "dotenv";
import { getStructuredData } from "./src/_data/structuredData.js";

dotenv.config();

/** @param {import('@11ty/eleventy').UserConfig} eleventyConfig */
export default function (eleventyConfig) {
  eleventyConfig.ignores.add("*.md");

  // Add filter for structured data
  eleventyConfig.addFilter("getStructuredData", function (page, metadata) {
    return getStructuredData(page, metadata);
  });

  // Shortcode to render raw JSON-LD to bypass WebC escaping
  eleventyConfig.addShortcode("renderStructuredData", function (json) {
    if (!json) return "";
    return `<script type="application/ld+json">${json}</script>`;
  });

  // Add date filter for sitemap
  eleventyConfig.addFilter("date", function (date, format) {
    const d = date === "now" ? new Date() : new Date(date);
    if (format === "YYYY-MM-DD") {
      return d.toISOString().split("T")[0];
    }
    return d.toISOString();
  });

  eleventyConfig.addPlugin(pluginWebc, {
    components: [
      "./src/_components/**/*.webc",
      "npm:@11ty/eleventy-img/*.webc",
    ],
  });

  eleventyConfig.setServerOptions({
    domDiff: false,
  });

  eleventyConfig.addPlugin(eleventyImagePlugin, {
    formats: ["webp", "jpeg"],
    urlPath: "/img/",

    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
    },
  });

  eleventyConfig.addPassthroughCopy({ "src/static/fonts": "fonts" });
  eleventyConfig.addPassthroughCopy({ "src/static/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/static/favicon": "favicon" });
  eleventyConfig.addPassthroughCopy({ "src/robots.txt": "robots.txt" });

  // Transform to unescape JSON-LD after WebC/Eleventy processing
  eleventyConfig.addTransform("unescape-json-ld", function (content) {
    if (this.page.outputPath && this.page.outputPath.endsWith(".html")) {
      return content.replace(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
        (match, p1) => {
          // Unescape common HTML entities that WebC might have injected
          const unescaped = p1
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">");
          return `<script type="application/ld+json">${unescaped}</script>`;
        }
      );
    }
    return content;
  });
}

export const config = {
  dir: {
    input: "src",
    output: "dist",
    includes: "_includes",
    layouts: "_layouts",
  },
};
