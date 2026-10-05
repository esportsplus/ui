// Demo-only documents for the examples; the library never ships them.
const samples = {
    editing: `// Edit freely: every change is undoable, and Save marks the draft clean.
type Greeting = { name: string; punctuation?: string };

export function greet({ name, punctuation = '!' }: Greeting) {
    return 'Hello, ' + name + punctuation;
}

export function farewell({ name }: Greeting) {
    return 'Goodbye, ' + name + '.';
}

console.log(greet({ name: 'Ada' }));
console.log(farewell({ name: 'Ada' }));
`,
    layout: `// Tab-indented, with long lines and trailing spaces: toggle the options above to see each one.
export const theme = {
\tcolors: {
\t\taccent: '#62a8ff',
\t\tsurface: '#ffffff'
\t},
\tspacing: [4, 8, 12, 16]
};

${Array.from({ length: 12 }, (_, i) => section(i + 1)).join('\n')}`,
    palette: `.swatch {
    --swatch-accent:  #62a8ff;
    --swatch-border:  #d4d4d8;
    --swatch-muted:   #71717a;
    --swatch-surface: #ffffff;
    --swatch-text:    #18181b;
}

.swatch-label {
    color: var(--swatch-text);
    border-color: var(--swatch-border);
}
`,
    services: `interface Person {
    name: string;
    score: number;
}

const person: Person = { name: 'Ada', score: TODO_ERROR };

function greet(person: Person): string {
    return 'Hello, ' + person.name;
}

gre
`,
    settings: `{
    "editor": { "minimap": true, "tabSize": 4, "wrap": false },
    "enabled": true,
    "theme": "light"
}
`
};

const workspaceFiles = {
    '.gitignore': 'node_modules/\ndist/\n',
    'AGENTS.md': '# Workspace instructions\n\nThis is an in-memory example workspace.\n',
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
    'package.json': '{\n  "name": "first-party-editor-demo",\n  "private": true,\n  "version": "1.0.0"\n}\n',
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
    'src/card.tsx': `type CardProps = { title: string; active: boolean };

export function Card({ title, active }: CardProps) {
    return <article className={active ? "active" : "idle"}>
        <h2>{title}</h2>
        <button disabled={!active}>Open</button>
    </article>;
}
`,
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
    'src/reset.css': `/* A plain stylesheet: selectors, properties, colors and units. */
*,
*::before,
*::after {
    box-sizing: border-box;
}

:root {
    --accent: #62a8ff;
    color-scheme: light dark;
}

@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
    }
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
`
};


function section(n: number) {
    return `export function section${n}(items: string[]) {
\tfor (let i = 0, n = items.length; i < n; i++) {
\t\tif (items[i].length > ${n}) {\t
\t\t\tconsole.log('Section ${n} keeps a deliberately long line that runs well past the right edge of the editor, so turning wrap on folds it onto the following rows: ' + items[i]);
\t\t}
\t}
}
`;
}


export { samples, workspaceFiles };
