import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    prefix?: string;
    words: string[];
};


// Long enough to read the finished sentence once.
const HOLD = 1800;

const REDUCED = '(prefers-reduced-motion: reduce)';

// How long the word sits selected before the first key replaces it: the beat where a person decides on the new
// word. Includes the selection sweep.
const SELECTED_FOR = 620;

// Reduced motion swaps whole words on this interval instead of typing.
const SWAP_EVERY = 2800;

// Per-character typing delay: a base plus up to this much jitter, which lands around 8 to 14 keys a second, the pace
// of someone who knows the word.
const TYPE_BASE = 62;

const TYPE_JITTER = 64;


// Deterministic, and smooth from key to key: a slow wave carries a rhythm through the word and a small hash roughens
// it, so delays vary the way a hand does instead of jumping between extremes.
function jitter(word: number, char: number) {
    let n = Math.sin(char * 12.9898 + word * 78.233) * 43758.5453,
        wave = Math.sin(char * 1.9 + word * 2.7) * 0.5 + 0.5;

    return wave * 0.7 + (n - Math.floor(n)) * 0.3;
}

function type(root: HTMLElement, text: HTMLElement, words: string[]) {
    let length = words[0].length,
        timer: ReturnType<typeof setTimeout> | undefined,
        word = 0;

    function key() {
        let target = words[word];

        if (length < target.length) {
            strike(target[length++]);
        }

        let finished = length === target.length;

        // Solid while keys are moving, blinking while it waits.
        root.classList.toggle('--typing', !finished);
        timer = finished
            ? setTimeout(select, HOLD)
            : setTimeout(key, TYPE_BASE + jitter(word, length) * TYPE_JITTER);
    }

    // Rewrites the way people do: select the word, then type over it. The first key replaces the whole selection
    // at once.
    function select() {
        if (words.length < 2) {
            return;
        }

        root.classList.add('--selecting');
        timer = setTimeout(() => {
            length = 0;
            text.textContent = '';
            word = (word + 1) % words.length;
            root.classList.remove('--selecting');
            key();
        }, SELECTED_FOR);
    }

    function strike(char: string) {
        let letter = document.createElement('span');

        letter.className = 'typewriter-retype-letter';
        letter.textContent = char;
        text.append(letter);
    }

    timer = setTimeout(select, HOLD);

    return () => {
        clearTimeout(timer);
        root.classList.remove('--selecting', '--typing');
        // Leaves the DOM as rendered, so a remount or motion change starts clean instead of from a half typed,
        // selected word.
        text.textContent = words[0];
    };
}


export default ({ prefix = '', words, ...attributes }: A) => {
    let lead = prefix ? `${prefix} ` : '',
        longest = words.reduce((a, b) => b.length > a.length ? b : a, ''),
        media: MediaQueryList | undefined,
        stop: VoidFunction | undefined,
        view = reactive({ index: 0, reduced: false });

    function change() {
        view.reduced = media?.matches ?? false;
    }

    return html`
        <span
            class='typewriter-retype ${() => view.reduced && '--reduced'}'
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    let text = element.querySelector<HTMLElement>('.typewriter-retype-text');

                    media = matchMedia(REDUCED);
                    media.addEventListener('change', change);
                    change();

                    if (!text || words.length === 0) {
                        return;
                    }

                    stop = effect(() => {
                        if (!view.reduced) {
                            onCleanup(type(element, text, words));
                            return;
                        }

                        if (words.length < 2) {
                            return;
                        }

                        let interval = setInterval(() => {
                            view.index = (view.index + 1) % words.length;
                        }, SWAP_EVERY);

                        onCleanup(() => clearInterval(interval));
                    });
                },
                ondisconnect: () => {
                    media?.removeEventListener('change', change);
                    stop?.();
                }
            }}
        >
            <span class='typewriter-retype-sr'>${`${lead}${new Intl.ListFormat('en', { type: 'disjunction' }).format(words)}.`}</span>
            <span aria-hidden='true' class='typewriter-retype-sizer'>${`${lead}${longest}`}</span>
            <span aria-hidden='true' class='typewriter-retype-line'>
                <span class='typewriter-retype-prefix'>${lead}</span>
                <span class='typewriter-retype-swap'>
                    ${words.map((word, i) => html`
                        <span class='typewriter-retype-option ${() => view.index === i && '--active'}'>${word}</span>
                    `)}
                </span>
                <span class='typewriter-retype-word'>
                    <span class='typewriter-retype-selection'></span>
                    <span class='typewriter-retype-text'>${words[0] ?? ''}</span>
                </span>
            </span>
        </span>
    `;
};
