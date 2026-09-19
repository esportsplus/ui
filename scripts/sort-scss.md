# Standalone SCSS sorter

Run with Node 20+; no bundler, Sass compiler, or PostCSS configuration is used.

```sh
node scripts/sort-scss.mjs --check path/to/styles
node scripts/sort-scss.mjs --write path/to/styles.scss
node scripts/sort-scss.mjs --write path/to/styles another/file.scss
```

Paths resolve from the current working directory. To use elsewhere, copy
`sort-scss.mjs` into a project with `postcss` and `postcss-scss` installed, or invoke
this installed script by absolute path. Dependencies are declared in
`package.json` (development dependencies).

The sorter orders consecutive sibling selector blocks by their full selector
text and consecutive declarations by property name, recursively, using
case-sensitive code-unit order. Punctuation and vendor prefixes participate in
that order. Equal keys retain their original relative order. Comma-separated
selector lists remain intact.

Sass nested selectors such as `&-actions`, `&-inner`, and `&-nav` are sorted
within their parent too. Use `--write` to apply changes; `--check` only reports them.

Leading comments move with the following statement; same-line trailing comments
move with the preceding statement. Existing whitespace and value text are
retained where possible. This organizes source; it does not impose indentation
or line wrapping.

At-rules, Sass variable assignments, interpolated property/selector names, and
transitions between declarations and nested rules divide sorting runs. Statements
never move across these boundaries. Contents of at-rules are processed recursively;
keyframe steps retain their order while properties inside each step are sorted.

Sorting is strict within each run: overlapping selectors and shorthand/longhand
properties are alphabetized even when this changes the cascade. Sass function
evaluation order can also change. Duplicate declarations retain fallback order.

Directory traversal skips `.git`, `node_modules`, and symlinks. Explicit symlink
targets and non-SCSS file targets are rejected. All inputs are parsed before any
write. A malformed input prevents writes for the batch; filesystem write failures
are reported but do not roll back earlier successful writes.

Exit status is 0 for success, 1 for unsorted files in check mode, and 2 for invalid
arguments, parse failures, or I/O errors. Check mode never writes.

```sh
node --test scripts/sort-scss.test.mjs
```
