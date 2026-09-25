import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    interval?: number;
    state?: State;
    words: string[];
};

type Letter = {
    char: string;
    node: HTMLSpanElement;
};

type State = {
    index: number;
    // Stops rotating and settles back on the first word.
    paused: boolean;
};


const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const ENTER_MS = 320;

// Leaving letters are gone before the glide lands, so the eye follows the letters that stay rather than the ones
// that go.
const EXIT_MS = 200;

// Shared letters can travel most of a word across, so they get longer than a typical UI tween; any shorter and the
// glide reads as a jump.
const GLIDE_MS = 440;

// Long enough to read the whole sentence once per word.
const INTERVAL = 2600;

const STAGGER_MS = 28;


function letter(char: string) {
    let node = document.createElement('span');

    node.className = 'word-rotator-letter';
    node.textContent = char;

    return { char, node };
}

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

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export default ({ interval = INTERVAL, state = reactive({ index: 0, paused: false }), words, ...attributes }: A) => {
    let box: HTMLElement | undefined,
        current = words[state.index] === undefined ? 0 : state.index,
        hovered = false,
        letters: Letter[] = [],
        stop: VoidFunction | undefined,
        timer: ReturnType<typeof setTimeout> | undefined;

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

        let from = box.getBoundingClientRect(),
            lefts = new Map<Letter, number>(),
            motion = !reduced(),
            // Rects are post-transform; a scaled ancestor would otherwise have every offset applied twice.
            s = from.width / box.offsetWidth || 1;

        // Visual position, mid-animation included, so a swap that lands during a glide continues from where the
        // letter really is.
        for (let i = 0, n = letters.length; i < n; i++) {
            lefts.set(letters[i], (letters[i].node.getBoundingClientRect().left - from.left) / s);
        }

        let chars = [...words[index]],
            entering = new Set<Letter>(),
            kept = new Set<Letter>(),
            // Reduced motion is a plain crossfade: nothing travels.
            pairs = motion ? match(letters.map((l) => l.char), chars) : new Map<number, number>(),
            next = chars.map((char, j) => {
                let p = pairs.get(j);

                if (p !== undefined) {
                    kept.add(letters[p]);
                    return letters[p];
                }

                let l = letter(char);

                entering.add(l);

                return l;
            });

        for (let i = 0, n = letters.length; i < n; i++) {
            let l = letters[i];

            if (kept.has(l)) {
                continue;
            }

            // Leaving letters stay where they stood, then float up and out.
            l.node.getAnimations().forEach((a) => a.cancel());
            l.node.classList.add('--exiting');
            l.node.style.left = `${lefts.get(l) ?? 0}px`;
            l.node.animate(
                motion
                    ? [
                        { filter: 'blur(0px)', opacity: 1, transform: 'translateY(0)' },
                        { filter: 'blur(4px)', opacity: 0, transform: 'translateY(-0.35em)' }
                    ]
                    : [{ opacity: 1 }, { opacity: 0 }],
                { duration: EXIT_MS, easing: EASE_OUT, fill: 'forwards' }
            ).onfinish = () => l.node.remove();
        }

        for (let i = 0, n = next.length; i < n; i++) {
            box.appendChild(next[i].node);
        }

        for (let node of box.querySelectorAll('.word-rotator-letter.--exiting')) {
            box.appendChild(node);
        }

        letters = next;
        current = index;

        // Settle everything first so the measurements below are the final layout, then animate from the old
        // picture to it.
        box.getAnimations().forEach((a) => a.cancel());

        for (let i = 0, n = letters.length; i < n; i++) {
            letters[i].node.getAnimations().forEach((a) => a.cancel());
        }

        let to = box.getBoundingClientRect(),
            order = 0,
            scale = to.width / box.offsetWidth || 1,
            width = to.width / scale;

        // Width, not scale: the sentence needs real layout space so the words around it slide instead of snapping.
        if (motion && Math.abs(width - from.width / s) > 0.5) {
            box.animate([{ width: `${from.width / s}px` }, { width: `${width}px` }], {
                duration: GLIDE_MS,
                easing: EASE_IN_OUT
            });
        }

        for (let i = 0, n = letters.length; i < n; i++) {
            let l = letters[i];

            if (entering.has(l)) {
                l.node.animate(
                    motion
                        ? [
                            { filter: 'blur(4px)', opacity: 0, transform: 'translateY(0.4em)' },
                            { filter: 'blur(0px)', opacity: 1, transform: 'translateY(0)' }
                        ]
                        : [{ opacity: 0 }, { opacity: 1 }],
                    {
                        // A beat for the leaving letters to clear the space, then a small left-to-right cascade.
                        delay: motion ? 90 + order++ * STAGGER_MS : 0,
                        duration: ENTER_MS,
                        easing: EASE_OUT,
                        fill: 'backwards'
                    }
                );
                continue;
            }

            let now = (l.node.getBoundingClientRect().left - to.left) / scale,
                was = lefts.get(l);

            if (was === undefined || Math.abs(was - now) < 0.5) {
                continue;
            }

            l.node.animate(
                [{ transform: `translateX(${was - now}px)` }, { transform: 'translateX(0)' }],
                { duration: GLIDE_MS, easing: EASE_IN_OUT }
            );
        }
    }

    return html`
        <span
            class='word-rotator'
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    box = element.querySelector<HTMLElement>('.word-rotator-box') ?? undefined;

                    if (!box) {
                        return;
                    }

                    letters = Array.from(box.querySelectorAll<HTMLSpanElement>('.word-rotator-letter')).map((node) => ({
                        char: node.textContent ?? '',
                        node
                    }));

                    stop = effect(() => {
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
                    stop?.();
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
            <span class='word-rotator-sr'>${words.join(', ')}</span>
            <span aria-hidden='true' class='word-rotator-box'>
                ${[...words[current]].map((char) => html`<span class='word-rotator-letter'>${char}</span>`)}
            </span>
        </span>
    `;
};

export type { State as WordRotatorState };
