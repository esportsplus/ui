import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive, ReactiveArray } from '@esportsplus/reactivity';
import { timing } from '~/shared/animation';


type A = Attributes & {
    interval?: number;
    state?: State;
    words: string[];
};

// 'left' is where it stood before a swap, measured; a letter without one is new to the word.
type Letter = {
    char: string;
    left?: number;
};

type State = {
    index: number;
    // Stops rotating and settles back on the first word.
    paused: boolean;
};


const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const ENTER_MS = 320;

// Leaving letters are gone before the glide lands, so the eye follows the letters that stay rather than the ones
// that go.
const EXIT_MS = 200;

// Long enough to read the whole sentence once per word.
const INTERVAL = 2600;

const STAGGER_MS = 28;


// Longest common subsequence, so the most letters possible survive the swap while keeping their order ("fast" to
// "honest" keeps both s and t). Maps next index to previous index.
function match(prev: string[], next: string[]) {
    let dp = Array.from({ length: prev.length + 1 }, () => new Array<number>(next.length + 1).fill(0)),
        i = 0,
        j = 0,
        pairs = new Map<number, number>();

    for (let a = prev.length - 1; a >= 0; a--) {
        for (let b = next.length - 1; b >= 0; b--) {
            dp[a][b] = prev[a] === next[b] ? dp[a + 1][b + 1] + 1 : Math.max(dp[a + 1][b], dp[a][b + 1]);
        }
    }

    while (i < prev.length && j < next.length) {
        if (prev[i] === next[j]) {
            pairs.set(j++, i++);
        }
        else if (dp[i + 1][j] >= dp[i][j + 1]) {
            i++;
        }
        else {
            j++;
        }
    }

    return pairs;
}


export default ({ interval = INTERVAL, state = reactive({ index: 0, paused: false }), words, ...attributes }: A) => {
    let box: HTMLElement | undefined,
        current = words[state.index] === undefined ? 0 : state.index,
        // Letters on their way out, kept apart so a swap that rebuilds the word leaves their exits running.
        exits = new ReactiveArray<Letter>(),
        hovered = false,
        letters = new ReactiveArray<Letter>([...words[current]].map((char) => ({ char }))),
        timer: ReturnType<typeof setTimeout> | undefined;

    let leaving = html.reactive(exits, (l) => html`<span class='typewriter-rotate-letter typewriter-rotate-letter--exiting' style='left: ${l.left ?? 0}px;'>${l.char}</span>`),
        word = html.reactive(letters, (l) => html`<span class='typewriter-rotate-letter'>${l.char}</span>`);

    function schedule() {
        clearTimeout(timer);

        if (state.paused) {
            // One last swap home after a short beat, then nothing runs.
            if (current !== 0) {
                timer = setTimeout(() => state.index = 0, 250);
            }

            return;
        }

        timer = setTimeout(() => {
            if (hovered || document.hidden) {
                schedule();
                return;
            }

            state.index = (current + 1) % words.length;
        }, interval);
    }

    function swap(index: number) {
        if (!box) {
            return;
        }

        // Every swap flushes, so the box always holds the word's letters in order, then the exits.
        let from = box.getBoundingClientRect(),
            // From the CSS; without one the swap is a plain crossfade, nothing travelling.
            glide = timing(getComputedStyle(box), 'glide'),
            nodes = box.children,
            // Rects are post-transform; a scaled ancestor would otherwise have every offset applied twice.
            s = from.width / box.offsetWidth || 1;

        // Visual position, mid-animation included, so a swap that lands during a glide continues from where the
        // letter really is.
        for (let i = 0, n = letters.length; i < n; i++) {
            letters[i].left = ((nodes[i]?.getBoundingClientRect().left ?? from.left) - from.left) / s;
        }

        let chars = [...words[index]],
            kept: boolean[] = [],
            pairs = glide ? match(letters.map((l) => l.char), chars) : new Map<number, number>(),
            next = chars.map((char, j): Letter => {
                let p = pairs.get(j);

                if (p === undefined) {
                    return { char };
                }

                kept[p] = true;

                return letters[p];
            }),
            out = exits.length;

        // Leaving letters stay where they stood, then float up and out.
        for (let i = 0, n = letters.length; i < n; i++) {
            if (!kept[i]) {
                exits.push({ char: letters[i].char, left: letters[i].left });
            }
        }

        letters.splice(0, letters.length, ...next);
        word.flush();
        leaving.flush();
        current = index;

        for (let i = out, n = exits.length; i < n; i++) {
            let l = exits[i];

            nodes[letters.length + i]?.animate(
                glide
                    ? [
                        { filter: 'blur(0px)', opacity: 1, transform: 'translateY(0)' },
                        { filter: 'blur(4px)', opacity: 0, transform: 'translateY(-0.35em)' }
                    ]
                    : [{ opacity: 1 }, { opacity: 0 }],
                { duration: EXIT_MS, easing: EASE_OUT, fill: 'forwards' }
            ).finished.then(() => {
                let at = exits.indexOf(l);

                if (at !== -1) {
                    exits.splice(at, 1);
                }
            }, () => {});
        }

        // Settle the width first so the measurements below are the final layout, then animate from the old
        // picture to it.
        box.getAnimations().forEach((a) => a.cancel());

        let to = box.getBoundingClientRect(),
            order = 0,
            scale = to.width / box.offsetWidth || 1,
            width = to.width / scale;

        // Width, not scale: the sentence needs real layout space so the words around it slide instead of snapping.
        if (glide && Math.abs(width - from.width / s) > 0.5) {
            box.animate([{ width: `${from.width / s}px` }, { width: `${width}px` }], glide);
        }

        for (let i = 0, n = letters.length; i < n; i++) {
            let l = letters[i],
                was = l.left;

            if (was === undefined) {
                nodes[i]?.animate(
                    glide
                        ? [
                            { filter: 'blur(4px)', opacity: 0, transform: 'translateY(0.4em)' },
                            { filter: 'blur(0px)', opacity: 1, transform: 'translateY(0)' }
                        ]
                        : [{ opacity: 0 }, { opacity: 1 }],
                    {
                        // A beat for the leaving letters to clear the space, then a small left-to-right cascade.
                        delay: glide ? 90 + order++ * STAGGER_MS : 0,
                        duration: ENTER_MS,
                        easing: EASE_OUT,
                        fill: 'backwards'
                    }
                );
                continue;
            }

            let now = ((nodes[i]?.getBoundingClientRect().left ?? to.left) - to.left) / scale;

            if (!glide || Math.abs(was - now) < 0.5) {
                continue;
            }

            nodes[i]?.animate(
                [{ transform: `translateX(${was - now}px)` }, { transform: 'translateX(0)' }],
                glide
            );
        }
    }

    return html`
        <span
            class='typewriter-rotate'
            ${attributes}
            ${{
                onconnect: () => {
                    if (!box) {
                        return;
                    }

                    effect(() => {
                        let index = state.index;

                        // Read so pausing and resuming reschedule.
                        state.paused;

                        if (index !== current && words[index] !== undefined) {
                            swap(index);
                        }

                        schedule();
                    });
                },
                ondisconnect: () => {
                    clearTimeout(timer);
                },
                onpointerenter: (e: PointerEvent) => {
                    if (e.pointerType !== 'touch') {
                        hovered = true;
                    }
                },
                onpointerleave: () => {
                    hovered = false;
                }
            }}
        >
            <span class='typewriter-rotate-sr'>${words.join(', ')}</span>
            <span
                aria-hidden='true'
                class='typewriter-rotate-box'
                ${{
                    onconnect: (element: HTMLElement) => {
                        box = element;
                    }
                }}
            >
                ${word}${leaving}
            </span>
        </span>
    `;
};

export type { State as TypewriterRotateState };
