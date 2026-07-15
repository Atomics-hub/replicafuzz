import { build } from "esbuild";

await build({
  entryPoints: ["fixtures/yjs/client.ts"],
  outfile: "dist/fixtures/yjs/client.bundle.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  minify: true,
  sourcemap: false,
  legalComments: "eof",
});
