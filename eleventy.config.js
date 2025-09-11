import pluginWebc from "@11ty/eleventy-plugin-webc";
import { eleventyImagePlugin } from "@11ty/eleventy-img";

/** @param {import('@11ty/eleventy').UserConfig} eleventyConfig */
export default function (eleventyConfig) {
  eleventyConfig.ignores.add("*.md");

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
}

export const config = {
  dir: {
    input: "src",
    output: "dist",
    includes: "_includes",
    layouts: "_layouts",
  },
};
