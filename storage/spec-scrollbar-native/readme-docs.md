---
type: docs
recommended-model: sonnet
status: PENDING
validation: deterministic
depends-on: scrollbar-native-core
files-own: [README.md]
---

# README scrollbar row update

## Rationale

The component table still describes `scrollbar` as a "Custom scrollbar container" — after the core item it is neither custom-drawn nor a container.

## Changes

The README component table describes the scrollbar as a native styling class rather than a wrapper container.

## Design

`README.md` line 88: change `| \`scrollbar\` | Custom scrollbar container |` to `| \`scrollbar\` | Native scrollbar styling |`. Touch nothing else.

## Reads

- src/components/scrollbar/index.ts — the post-core component the wording must describe

## Acceptance

The old wording is gone and the new wording present in README.md; no other line changes.

## Checks

- `grep -q "Custom scrollbar container" d:/ui/README.md && exit 1 || exit 0`
- `grep -q "Native scrollbar styling" d:/ui/README.md`
