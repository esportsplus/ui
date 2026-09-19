#!/usr/bin/env node
import * as NodeFSP from "node:fs/promises";
import { realpathSync } from "node:fs";
import * as NodePath from "node:path";
import { fileURLToPath } from "node:url";
import scss from "postcss-scss";

const help = `Usage: node sort-scss.mjs --check|--write <file.scss|directory>...

Alphabetize sibling selectors and declaration properties recursively.
Group sibling .prefix-* classes into .prefix { &-* { ... } } blocks.
Sorting is strict and may change the cascade or Sass evaluation behavior.
At-rules, Sass assignments, and interpolated names remain ordering boundaries.
Duplicate properties retain their relative order. Keyframe steps stay in place.
Directories are recursive; .git and node_modules are excluded.
Exit codes: 0 = success, 1 = unsorted (--check), 2 = invalid input or I/O error.
`;

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortableKind(node, keyframes) {
  if (node.type === "decl" && !node.prop.includes("$") && !node.prop.includes("#{")) {
    return "decl";
  }
  if (node.type === "rule" && !keyframes && !node.selector.includes("#{")) {
    return "rule";
  }
  return null;
}

function unitsFor(nodes) {
  const units = [];
  let comments = [];
  for (const node of nodes) {
    if (node.type === "comment") {
      const previous = units.at(-1);
      if (previous && comments.length === 0 && !/[\r\n]/.test(node.raws.before ?? "")) {
        previous.nodes.push(node);
      } else {
        comments.push(node);
      }
    } else {
      units.push({ node, nodes: [...comments, node] });
      comments = [];
    }
  }
  if (comments.length) units.push({ node: null, nodes: comments });
  return units;
}

function sortContainer(container) {
  if (!container.nodes) return;
  for (const node of container.nodes) sortContainer(node);
  const keyframes = container.type === "atrule" && /(?:^|-)keyframes$/i.test(container.name);
  const units = unitsFor(container.nodes);
  let changed = false;
  for (let start = 0; start < units.length; ) {
    const kind = units[start].node && sortableKind(units[start].node, keyframes);
    if (!kind) {
      start++;
      continue;
    }
    let end = start + 1;
    while (
      end < units.length &&
      units[end].node &&
      sortableKind(units[end].node, keyframes) === kind
    )
      end++;
    const original = units.slice(start, end);
    const sorted = original.toSorted((a, b) =>
      compare(
        kind === "decl" ? a.node.prop : a.node.selector.trim(),
        kind === "decl" ? b.node.prop : b.node.selector.trim(),
      ),
    );
    if (sorted.some((unit, index) => unit !== original[index])) {
      // Keep spacing at each position while moving comments with their owner.
      const spacing = original.map((unit) => unit.nodes[0].raws.before);
      sorted.forEach((unit, index) => {
        unit.nodes[0].raws.before = spacing[index];
      });
      units.splice(start, end - start, ...sorted);
      changed = true;
    }
    start = end;
  }
  if (changed) {
    container.removeAll();
    for (const unit of units) container.append(unit.nodes);
    // Moving a // comment must not comment out the next statement or closing brace.
    for (let index = 1; index < container.nodes.length; index++) {
      const previous = container.nodes[index - 1];
      const node = container.nodes[index];
      if (
        previous.type === "comment" &&
        previous.raws.inline &&
        !/[\r\n]/.test(node.raws.before ?? "")
      ) {
        node.raws.before = "\n" + (node.raws.before ?? "");
      }
    }
    if (
      container.last?.type === "comment" &&
      container.last.raws.inline &&
      !/[\r\n]/.test(container.raws.after ?? "")
    ) {
      container.raws.after = "\n" + (container.raws.after ?? "");
    }
  }
}

function nestPrefixes(container, indent, newline) {
  if (!container.nodes) return;
  for (const node of [...container.nodes]) nestPrefixes(node, indent, newline);
  if (container.type === "atrule" && /(?:^|-)keyframes$/i.test(container.name)) return;

  const units = unitsFor(container.nodes);
  const prefix = (unit) => unit.node?.type === "rule"
    ? /^(\.[a-zA-Z_][\w]*)-[\w-]+$/.exec(unit.node.selector.trim())?.[1]
    : undefined;

  for (let start = 0; start < units.length; ) {
    const name = prefix(units[start]);
    let end = start + 1;
    if (name) while (end < units.length && prefix(units[end]) === name) end++;
    if (!name || end - start < 2) {
      start = end;
      continue;
    }

    const first = units[start].nodes[0];
    const before = first.raws.before ?? "";
    const baseIndent = /(?:^|\n)([\t ]*)$/.exec(before)?.[1] ?? "";
    const wrapper = scss.parse(`${name} {}`).first;
    wrapper.raws.before = before;
    wrapper.raws.after = newline + baseIndent;
    container.insertBefore(first, wrapper);

    for (const unit of units.slice(start, end)) {
      unit.node.selector = "&" + unit.node.selector.trim().slice(name.length);
      for (const node of unit.nodes) {
        const shift = (value) => value?.replace(/(\r?\n)([\t ]*)(?=\S)/g, `$1$2${indent}`);
        const shiftBefore = (value) => value?.replace(/([\t ]*)$/, `$1${indent}`);
        node.raws.before = shiftBefore(node.raws.before);
        node.raws.after = /[\r\n]/.test(node.raws.after ?? "") ? shiftBefore(node.raws.after) : node.raws.after;
        node.walk?.((child) => {
          child.raws.before = shiftBefore(child.raws.before);
          child.raws.after = /[\r\n]/.test(child.raws.after ?? "") ? shiftBefore(child.raws.after) : child.raws.after;
          if (child.type === "rule") child.selector = shift(child.selector);
        });
        // Ensure standalone comments and inline input both start safely inside the wrapper.
        if (!/[\r\n]/.test(node.raws.before ?? "")) {
          node.raws.before = newline + baseIndent + indent;
        }
        wrapper.append(node);
      }
    }
    wrapper.first.raws.before = newline + baseIndent + indent;
    start = end;
  }
}

export function sortScss(source, file = "input.scss") {
  const root = scss.parse(source, { from: file });
  sortContainer(root);
  const indent = source.match(/\n([\t ]+)\S/)?.[1] ?? "    ";
  nestPrefixes(root, indent, source.includes("\r\n") ? "\r\n" : "\n");
  sortContainer(root);
  return root.toString(scss.stringify);
}

async function collect(paths) {
  const files = new Set();
  async function visit(path, explicit = false) {
    const stat = await NodeFSP.lstat(path);
    if (stat.isSymbolicLink()) {
      if (explicit) throw new Error(`Refusing symlink: ${path}`);
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of await NodeFSP.readdir(path, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        await visit(NodePath.join(path, entry.name));
      }
    } else if (stat.isFile() && NodePath.extname(path).toLowerCase() === ".scss") {
      files.add(path);
    } else if (explicit) {
      throw new Error(`Expected an SCSS file or directory: ${path}`);
    }
  }
  for (const path of paths) await visit(NodePath.resolve(path), true);
  if (!files.size) throw new Error("No SCSS files found.");
  return [...files].sort(compare);
}

async function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    process.stdout.write(help);
    return;
  }
  const modes = args.filter((arg) => arg === "--check" || arg === "--write");
  const paths = args.filter((arg) => !arg.startsWith("--"));
  if (
    modes.length !== 1 ||
    paths.length === 0 ||
    args.some((arg) => arg.startsWith("--") && !modes.includes(arg))
  ) {
    throw new Error(help);
  }
  // Parse the entire batch before writing so a syntax error cannot leave a partial batch.
  const changes = [];
  for (const file of await collect(paths)) {
    const source = await NodeFSP.readFile(file, "utf8");
    const output = sortScss(source, file);
    if (output !== source) changes.push({ file, output });
  }
  for (const { file, output } of changes) {
    if (modes[0] === "--write") await NodeFSP.writeFile(file, output, "utf8");
    console.log(`${modes[0] === "--write" ? "Sorted" : "Unsorted"}: ${file}`);
  }
  if (modes[0] === "--check" && changes.length) process.exitCode = 1;
}

// Older Node versions do not define import.meta.main and silently skipped the CLI.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`sort-scss: ${error.message}`);
    process.exitCode = 2;
  });
}
