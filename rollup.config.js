// rollup.config.js
const svelte = require("rollup-plugin-svelte");
const commonjs = require("@rollup/plugin-commonjs");
const resolve = require("@rollup/plugin-node-resolve");
const typescript = require("@rollup/plugin-typescript");
const css = require("rollup-plugin-css-only");
const terser = require("@rollup/plugin-terser");
const sveltePreprocess = require("svelte-preprocess");
const path = require("path");

const production = !process.env.ROLLUP_WATCH;

// Svelte app bundle
const mainBundle = {
  input: "src/svelte/main.ts",
  output: {
    sourcemap: true,
    format: "iife",
    name: "app",
    file: "public/bundle.js",
  },
  plugins: [
    svelte({
      preprocess: sveltePreprocess({ sourceMap: !production }),
      compilerOptions: {
        dev: !production,
      },
    }),
    css({ output: "bundle.css" }),
    resolve({
      browser: true,
      dedupe: ["svelte"],
    }),
    commonjs(),
    typescript({
      sourceMap: !production,
      inlineSources: !production,
    }),
    production && terser(),
  ],
};

// Electron main process bundle
const electronBundle = {
  input: "src/electron/main.ts",
  output: {
    sourcemap: true,
    format: "cjs",
    name: "main",
    file: "dist/electron/main.js",
  },
  plugins: [
    resolve({
      browser: false,
      dedupe: ["svelte"],
    }),
    commonjs(),
    typescript({
      sourceMap: !production,
      inlineSources: !production,
    }),
    production && terser(),
  ],
  external: ["electron", "child_process", "fs", "path", "url", "module", "os"],
};

module.exports = [mainBundle, electronBundle];
