/** Shared, deterministic documents for the workspace demo and browser acceptance tests. */
export const workspaceFiles = {
    'src/greeting.ts': `// Edit this document, then switch tabs without losing your draft.
export interface Person {
    name: string;
    score: number;
}

export function greet(person: Person): string {
    if (person.score > 0) {
        return "Hello, " + person.name;
    }
    return "Welcome";
}

const person: Person = { name: "Ada", score: 3 };
console.log(greet(person));
`,
    'src/card.tsx': `type CardProps = { title: string; active: boolean };

export function Card({ title, active }: CardProps) {
    return <article className={active ? "active" : "idle"}>
        <h2>{title}</h2>
        <button disabled={!active}>Open</button>
    </article>;
}
`,
    'src/theme.scss': `$accent: #62a8ff;

.card {
    color: $accent;
    padding: 1rem;

    &:hover {
        background: rgba(98, 168, 255, .12);
    }
}
`,
    'src/index.html': `<!doctype html>
<html lang="en">
    <head>
        <style>
            .card { color: #62a8ff; }
        </style>
    </head>
    <body>
        <main class="card">Hello &amp; welcome</main>
        <script>
            const greeting = "Hello";
            console.log(greeting);
        </script>
    </body>
</html>
`,
    'scripts/report.py': `"""A small Python sample with a multiline string."""
from dataclasses import dataclass

@dataclass
class Person:
    name: str
    score: int = 0

def report(person: Person) -> str:
    if person.score > 0:
        return f"{person.name}: {person.score}"
    return "No score"
`,
    'package.json': '{\n  "name": "first-party-editor-demo",\n  "private": true,\n  "version": "1.0.0"\n}\n',
    'README.md': `---
title: Editor workspace
tags: [demo, markdown]
---

# Editor workspace

Click a block to edit its source. Move away to see **bold**, *italic*, ~~deleted~~, and \`inline code\`.

## Tasks

- [ ] Try the task checkbox
- [x] Keep source and undo history together

> A quoted paragraph with a [safe link](https://example.com).

1. Open another document.
2. Return here with your draft intact.

\`\`\`typescript
const ready = true;
console.log(ready);
\`\`\`

<details><summary>HTML block</summary><p>Safe <strong>HTML</strong> content.</p></details>
`,
    'notes/long-lines.txt': Array.from({ length: 180 }, (_, index) => `${index + 1}. ${'Wrap, scroll, fold and navigate without changing the source. '.repeat(8)}`).join('\n'),
    'notes/whitespace.txt': 'spaces    between    words\n\tone tab\n\t\ttwo tabs\ntrailing spaces   \n',
    '.gitignore': 'node_modules/\ndist/\n',
    'AGENTS.md': '# Workspace instructions\n\nThis is an in-memory example workspace.\n'
};
