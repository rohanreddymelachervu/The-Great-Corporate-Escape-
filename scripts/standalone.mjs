import { readFile, writeFile, mkdir } from "node:fs/promises";
let html = await readFile("dist/index.html", "utf8");
html = html.replace(
  /<script type="module" crossorigin src="([^"]+)"><\/script>/g,
  (_, p) => `<script>${"__BUNDLE__"}</script>`,
);
const js = (await readFile("dist/assets/game.js", "utf8")).replace(
  /<\/script/gi,
  "<\\/script",
);
html = html.replace("__BUNDLE__", () => js);
const cssMatch = html.match(
  /<link rel="stylesheet" crossorigin href="([^"]+)">/,
);
if (cssMatch) {
  const css = await readFile(
    "dist/" + cssMatch[1].replace(/^\.\//, ""),
    "utf8",
  );
  html = html.replace(cssMatch[0], () => `<style>${css}</style>`);
}
await mkdir("release", { recursive: true });
await writeFile("release/office-escape.html", html);
console.log(
  "Self-contained release:",
  Buffer.byteLength(html),
  "bytes. No network dependencies.",
);
