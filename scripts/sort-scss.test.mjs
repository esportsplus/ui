import * as NodeAssert from "node:assert/strict";
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeTest from "node:test";
import scss from "postcss-scss";
import { compileString } from "sass";
import { sortScss } from "./sort-scss.mjs";

const script = NodeURL.fileURLToPath(new URL("./sort-scss.mjs", import.meta.url));

NodeTest.test("nests prefixed classes with equivalent CSS, comments and stable output", () => {
  const input = `// Name\n.spec-name { color: red; }\n.spec-table { td { color: blue; } &:hover { opacity: 1; } }\n.spec-value { color: green; }\n`;
  const output = sortScss(input);
  const root = scss.parse(output);
  NodeAssert.equal(root.first.selector, ".spec");
  NodeAssert.deepEqual(root.first.nodes.filter(n => n.type === "rule").map(n => n.selector),
    ["&-name", "&-table", "&-value"]);
  NodeAssert.match(output, /\/\/ Name\n/);
  // Sorting already orders nested selectors; compare against that canonical CSS.
  const canonical = input.replace('td { color: blue; } &:hover { opacity: 1; }', '&:hover { opacity: 1; } td { color: blue; }');
  NodeAssert.equal(compileString(output, { style: "compressed" }).css, compileString(canonical, { style: "compressed" }).css);
  NodeAssert.equal(sortScss(output), output);
});

NodeTest.test("prefix grouping respects scopes, complex selectors and Sass boundaries", () => {
  const input = `.spec-a { color: red; }\n$gap: 1px;\n.spec-b { color: blue; }\n.spec-c:hover { color: red; }\n.spec-d { color: green; }\n@media (width > 1px) { .item-a { color: red; } .item-b { color: blue; } }`;
  const output = sortScss(input);
  NodeAssert.equal(compileString(output, { style: "compressed" }).css, compileString(input, { style: "compressed" }).css);
  NodeAssert.match(output, /\.spec-a/);
  NodeAssert.match(output, /\.spec-b/);
  NodeAssert.match(output, /\.spec-c:hover/);
  NodeAssert.equal(scss.parse(output).last.first.selector, ".item");
  NodeAssert.equal(sortScss(output), output);
});

NodeTest.test("prefix grouping preserves CRLF and an existing base selector", () => {
  const input = ".spec { color: black; }\r\n.spec-a { color: red; }\r\n.spec-b { color: blue; }\r\n";
  const output = sortScss(input);
  NodeAssert.equal(compileString(output, { style: "compressed" }).css, compileString(input, { style: "compressed" }).css);
  NodeAssert.equal(output.replaceAll("\r\n", "").includes("\n"), false);
  NodeAssert.equal(sortScss(output), output);
});

NodeTest.test("prefix grouping indents multiline selectors without whitespace-only lines", () => {
  const output = sortScss(".spec-a {\n    td,\n    th { color: red; }\n}\n\n.spec-b {\n    color: blue;\n}\n");
  NodeAssert.match(output, /        td,\n        th/);
  NodeAssert.doesNotMatch(output, /^[\t ]+$/m);
  NodeAssert.equal(sortScss(output), output);
});

NodeTest.test("sorts Sass suffix selectors recursively and keeps media boundaries", () => {
  const output = sortScss(`.header {
    position: sticky;
    &-inner { width: 100%; display: flex; }
    &-nav {}
    &-link { font-weight: 500; color: red; &-z {} &-a {} }
    &-actions {}
    &-icon {}
    @media (max-width: 720px) { &-nav {} &-inner {} }
  }`);
  const nodes = scss.parse(output).first.nodes;
  NodeAssert.deepEqual(nodes.map((node) => node.prop ?? node.selector ?? node.name),
    ["position", "&-actions", "&-icon", "&-inner", "&-link", "&-nav", "media"]);
  NodeAssert.deepEqual(nodes[4].nodes.map((node) => node.prop ?? node.selector),
    ["color", "font-weight", "&-a", "&-z"]);
  NodeAssert.deepEqual(nodes.at(-1).nodes.map((node) => node.selector),
    ["&-inner", "&-nav"]);
  NodeAssert.equal(sortScss(output), output);
});

NodeTest.test("inline comments cannot swallow a closing brace after sorting", () => {
  const output = sortScss(".a {\n z-index: 1; // layer\n color: red; }");
  const parsed = scss.parse(output);
  NodeAssert.deepEqual(
    parsed.first.nodes.filter((node) => node.type === "decl").map((node) => node.prop),
    ["color", "z-index"],
  );
  NodeAssert.equal(sortScss(output), output);
});

NodeTest.test("retains BOM and CRLF in an already sorted file", () => {
  const input = "\uFEFF.a {\r\n  color: red;\r\n}\r\n";
  NodeAssert.equal(sortScss(input), input);
});

NodeTest.test("sorts selectors and properties recursively, including inside media queries", () => {
  const output = sortScss(`.z { z-index: 1; color: red; &.z { width: 1px; color: red } &.a {} }
.a { width: 1px; display: block }
@media (width > 1px) { .z {} .a { width: 2px; color: blue } }`);
  const root = scss.parse(output);
  NodeAssert.deepEqual(
    root.nodes.map((node) => node.selector ?? node.name),
    [".a", ".z", "media"],
  );
  NodeAssert.deepEqual(
    root.first.nodes.map((node) => node.prop),
    ["display", "width"],
  );
  NodeAssert.deepEqual(
    root.nodes[1].nodes.map((node) => node.prop ?? node.selector),
    ["color", "z-index", "&.a", "&.z"],
  );
  NodeAssert.deepEqual(
    root.last.nodes.map((node) => node.selector),
    [".a", ".z"],
  );
  NodeAssert.equal(sortScss(output), output);
});

NodeTest.test(
  "keeps Sass boundaries and fallback order while sorting declarations on either side",
  () => {
    const output = sortScss(`.a {
  z-index: 1; color: red;
  $value: 2;
  width: $value; display: -webkit-box; display: flex;
  @include size;
  padding: 0; color: blue;
}`);
    const nodes = scss.parse(output).first.nodes;
    NodeAssert.deepEqual(
      nodes.map((node) => node.prop ?? `@${node.name}`),
      ["color", "z-index", "$value", "display", "display", "width", "@include", "color", "padding"],
    );
    NodeAssert.deepEqual(
      nodes.filter((node) => node.prop === "display").map((node) => node.value),
      ["-webkit-box", "flex"],
    );
  },
);

NodeTest.test(
  "moves leading and inline comments with their owners and preserves SCSS syntax",
  () => {
    const input = `// z selector
.z {
  // width explanation
  width: 1px; // width inline
  color: red;
}
// a selector
.a { content: "braces {}; // text"; background: url("a;b.svg"); }
`;
    const output = sortScss(input);
    NodeAssert.ok(output.startsWith("// a selector\n.a"));
    NodeAssert.match(
      output,
      /color: red;\n  \/\/ width explanation\n  width: 1px; \/\/ width inline/,
    );
    NodeAssert.ok(output.includes('"braces {}; // text"'));
    NodeAssert.equal(sortScss(output), output);
  },
);

NodeTest.test(
  "preserves interpolated selectors, variable assignments and keyframe step order",
  () => {
    const input = `.z {} .#{$name} {} .a {}
@keyframes pulse { to { width: 1px; color: red } from { opacity: 0 } 50% { opacity: 1 } }`;
    const root = scss.parse(sortScss(input));
    NodeAssert.deepEqual(
      root.nodes.slice(0, 3).map((node) => node.selector),
      [".z", ".#{$name}", ".a"],
    );
    NodeAssert.deepEqual(
      root.last.nodes.map((node) => node.selector),
      ["to", "from", "50%"],
    );
    NodeAssert.deepEqual(
      root.last.first.nodes.map((node) => node.prop),
      ["color", "width"],
    );
  },
);

NodeTest.test("CLI checks without writing, writes recursively, then checks clean", async () => {
  const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "sort-scss-"));
  try {
    const file = NodePath.join(dir, "sample.scss");
    const input = ".z {}\n.a { width: 0; color: red }\n";
    await NodeFSP.writeFile(file, input);
    const run = (mode) =>
      NodeChildProcess.spawnSync(process.execPath, [script, mode, dir], {
        cwd: NodeOS.tmpdir(),
        encoding: "utf8",
      });
    NodeAssert.equal(run("--check").status, 1);
    NodeAssert.equal(await NodeFSP.readFile(file, "utf8"), input);
    NodeAssert.equal(run("--write").status, 0);
    NodeAssert.equal(await NodeFSP.readFile(file, "utf8"), ".a { color: red; width: 0 }\n.z {}\n");
    NodeAssert.equal(run("--check").status, 0);
  } finally {
    await NodeFSP.rm(dir, { recursive: true, force: true });
  }
});

NodeTest.test("CLI refuses invalid input before writing any file in the batch", async () => {
  const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "sort-scss-"));
  try {
    const good = NodePath.join(dir, "a.scss");
    const bad = NodePath.join(dir, "z.scss");
    const input = ".z {} .a {}";
    await NodeFSP.writeFile(good, input);
    await NodeFSP.writeFile(bad, ".broken {");
    const result = NodeChildProcess.spawnSync(process.execPath, [script, "--write", dir], {
      encoding: "utf8",
    });
    NodeAssert.equal(result.status, 2);
    NodeAssert.match(result.stderr, /Unclosed block/);
    NodeAssert.equal(await NodeFSP.readFile(good, "utf8"), input);
  } finally {
    await NodeFSP.rm(dir, { recursive: true, force: true });
  }
});
