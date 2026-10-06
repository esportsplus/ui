import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import diffs, { acceptChange, revertChange, type DiffsController } from '@esportsplus/ui/components/editor/diffs';
import type { Entry } from 'docs/types';
import 'docs/examples/diffs/scss/index.scss';


const BASE = `import { clamp } from './math';


const DURATION = 200;

export function animate(element: HTMLElement, to: number) {
    let from = element.offsetTop,
        start = performance.now();

    function frame(now: number) {
        let progress = (now - start) / DURATION;

        element.style.transform = \`translateY(\${from + (to - from) * progress}px)\`;

        if (progress < 1) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}
`;

const CURRENT = `import { clamp } from './math';


const DURATION = 240;

export function animate(element: HTMLElement, to: number) {
    let from = element.offsetTop,
        start = performance.now();

    function frame(now: number) {
        let progress = clamp((now - start) / DURATION, 0, 1);

        element.style.transform = \`translateY(\${from + (to - from) * progress}px)\`;

        if (progress < 1) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}
`;

const INCOMING = `import { clamp, ease } from './math';


const DURATION = 320;

export function animate(element: HTMLElement, to: number, easing = ease) {
    let from = element.offsetTop,
        start = performance.now();

    function frame(now: number) {
        let progress = (now - start) / DURATION;

        element.style.transform = \`translateY(\${from + (to - from) * easing(progress)}px)\`;

        if (progress < 1) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}
`;

const MODIFIED = `import { clamp } from './math';
import type { Options } from './types';


const DEFAULTS: Options = { duration: 240, easing: 'ease-out' };

export function animate(element: HTMLElement, to: number, options: Partial<Options> = {}) {
    let { duration, easing } = { ...DEFAULTS, ...options },
        from = element.offsetTop,
        start = performance.now();

    element.style.transitionTimingFunction = easing;

    function frame(now: number) {
        let progress = clamp((now - start) / duration, 0, 1);

        element.style.transform = \`translateY(\${from + (to - from) * progress}px)\`;

        if (progress < 1) {
            requestAnimationFrame(frame);
        }
    }

    requestAnimationFrame(frame);
}
`;

const ORIGINAL = `import { clamp } from './math';


const DURATION = 200;

export function animate(element: HTMLElement, to: number) {
    let from = element.offsetTop,
        start = performance.now();

    function frame(now: number) {
        let progress = clamp((now - start) / DURATION, 0, 1);

        element.style.transform = \`translateY(\${from + (to - from) * progress}px)\`;

        if (progress < 1) {
            requestAnimationFrame(frame);
        }
        else {
            element.dispatchEvent(new Event('animationend'));
        }
    }

    requestAnimationFrame(frame);
}
`;

const PROSE_MODIFIED = `The quick brown fox jumps over the lazy dog.
Pack my box with five dozen liquor jugs.
How vexingly quick daft zebras jump!
Sphinx of black quartz, judge my vow.
The five boxing wizards jump quickly.`;

const PROSE_ORIGINAL = `The quick brown fox jumped over the sleepy dog.
Pack my box with five dozen liquor jugs.
How quickly daft zebras jump!
Sphinx of black quartz, hear my vow.
The five boxing wizards jump quickly.`;

// Reformatted lines only differ in whitespace; one line really changed.
const REFORMATTED = `function total(items) {
  let sum = 0;
  for (let item of items) {
    sum += item.price * item.quantity;
  }
  return sum;
}`;

const SPACED = `function total(items) {
    let sum = 0;
    for (let item of items) {
        sum += item.price;
    }
    return sum;
}`;


function large() {
    let original: string[] = [],
        modified: string[] = [];

    for (let i = 0; i < 20000; i++) {
        let line = `export const value${i} = compute(${i}, 'entry ${i}');`;

        original.push(line);

        if (i % 997 === 0) {
            modified.push(`export const value${i} = compute(${i * 2}, 'entry ${i}', { cached: true });`);
        }
        else if (i % 1499 !== 0) {
            modified.push(line);
        }

        if (i % 2003 === 0) {
            modified.push(`// Inserted after line ${i + 1}`);
        }
    }

    return { modified: modified.join('\n'), original: original.join('\n') };
}

function merging() {
    let state = reactive({ result: '' });

    return html`
        <div class='diffs-demo'>
            ${diffs.merge({
                base: BASE,
                current: CURRENT,
                filename: 'src/animate.ts',
                incoming: INCOMING,
                onresolve: (result: string) => {
                    state.result = result;
                }
            })}
            ${() => state.result && html`
                <p class='diffs-demo-caption'>Merged, ${state.result.split('\n').length} lines:</p>
                <pre class='diffs-demo-result'>${state.result}</pre>
            `}
        </div>
    `;
}

function reviewing() {
    let controller: DiffsController | undefined,
        texts = { modified: MODIFIED, original: ORIGINAL };

    return html`
        <div class='diffs-demo'>
            ${diffs({
                controller: (value: DiffsController) => {
                    controller = value;
                },
                filename: 'src/animate.ts',
                modified: texts.modified,
                onaccept: (change) => {
                    texts.original = acceptChange(texts.original, change);
                    controller?.setTexts(texts.original, texts.modified);
                },
                onrevert: (change) => {
                    texts.modified = revertChange(texts.modified, change);
                    controller?.setTexts(texts.original, texts.modified);
                },
                original: texts.original
            })}
            <p class='diffs-demo-caption'>Hover a change for Accept and Revert; Alt+F5 and Shift+Alt+F5 step through changes.</p>
        </div>
    `;
}


export default {
    name: 'diffs',
    variants: [
        {
            render: reviewing,
            title: 'split: syntax colors, accept and revert'
        },
        {
            render: () => html`
                <div class='diffs-demo'>
                    ${diffs({ filename: 'src/animate.ts', mode: 'unified', modified: MODIFIED, original: ORIGINAL })}
                </div>
            `,
            title: 'unified'
        },
        {
            render: () => html`
                <div class='diffs-demo'>
                    ${diffs({ class: 'diffs-demo-compact', filename: 'pangrams.txt', modified: PROSE_MODIFIED, original: PROSE_ORIGINAL })}
                    ${diffs({ class: 'diffs-demo-compact', filename: 'pangrams.txt', modified: PROSE_MODIFIED, original: PROSE_ORIGINAL, wordDiff: false })}
                </div>
            `,
            title: 'word diff: on and off'
        },
        {
            render: () => html`
                <div class='diffs-demo'>
                    ${diffs({ class: 'diffs-demo-compact', filename: 'total.js', modified: REFORMATTED, original: SPACED })}
                    ${diffs({ class: 'diffs-demo-compact', filename: 'total.js', ignoreWhitespace: true, modified: REFORMATTED, original: SPACED })}
                </div>
            `,
            title: 'ignore whitespace: off and on'
        },
        {
            render: () => {
                let { modified, original } = large();

                return html`
                    <div class='diffs-demo'>
                        ${diffs({ context: 5, filename: 'src/values.ts', modified, original })}
                    </div>
                `;
            },
            title: 'large file: 20,000 lines, virtualized'
        },
        {
            render: merging,
            title: 'merge: incoming, current and an editable result'
        }
    ]
} satisfies Entry;
