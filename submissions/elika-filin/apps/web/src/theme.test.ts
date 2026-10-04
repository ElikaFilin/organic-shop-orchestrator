// @vitest-environment node
// Reads two files and touches no DOM; under the web project's jsdom environment `import.meta.url` is an
// http:// URL, which `fileURLToPath` refuses, so this one file runs in the node environment.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// jsdom applies no stylesheet and never sees index.html, so the forced light scheme is asserted on the files:
// the only honest test for a stylesheet rule.
test("Light color scheme is forced", () => {
  const css = readFileSync(fileURLToPath(new URL("./index.css", import.meta.url)), "utf8");
  expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light;?[^}]*\}/);

  const html = readFileSync(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
  expect(html).toMatch(/<body[^>]*class="[^"]*\bbg-white\b[^"]*"/);
  expect(html).toMatch(/<body[^>]*class="[^"]*\btext-stone-900\b[^"]*"/);
});
