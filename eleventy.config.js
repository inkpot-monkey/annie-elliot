import pluginWebc from "@11ty/eleventy-plugin-webc";

/** @param {import('@11ty/eleventy').UserConfig} eleventyConfig */
export default function (eleventyConfig) {
  eleventyConfig.ignores.add("*.md");

  eleventyConfig.addPlugin(pluginWebc, {
    components: ["./src/_components/**/*.webc"],
  });

  eleventyConfig.setServerOptions({
    domDiff: false,
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
