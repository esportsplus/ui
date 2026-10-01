import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { reduced } from '~/shared/animation';


type A = Attributes & {
    prefix?: string;
    words: string[];
};


// Long enough to read the finished sentence once.
const HOLD = 1800;

// How long the word sits selected before the first key replaces it: the beat where a person decides on the new
// word. Includes the selection sweep.
const SELECTED_FOR = 620;

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


export default ({ prefix = '', words, ...attributes }: A) => {
    let lead = prefix ? `${prefix} ` : '',
        letters = reactive([] as string[]),
        longest = words.reduce((a, b) => b.length > a.length ? b : a, ''),
        timer: ReturnType<typeof setTimeout> | undefined,
        // 'typewriter-retype--selecting' while the word is selected, 'typewriter-retype--typing' while keys are moving.
        view = reactive({ retyped: false, state: '' });

    return html`
        <span class='typewriter-retype ${() => view.state}' ${attributes} ${{
            onconnect: () => {
                if (words.length < 2) {
                    return;
                }

                let length = words[0].length,
                    word = 0;

                // Reduced motion lands the whole word in one key, fading in without the blur.
                function key() {
                    let target = words[word],
                        end = reduced() ? target.length : length + 1;

                    letters.push(...target.slice(length, end));
                    length = end;

                    let finished = length >= target.length;

                    // Solid while keys are moving, blinking while it waits.
                    view.state = finished ? '' : 'typewriter-retype--typing';
                    timer = finished
                        ? setTimeout(select, HOLD)
                        : setTimeout(key, TYPE_BASE + jitter(word, length) * TYPE_JITTER);
                }

                // Rewrites the way people do: select the word, then type over it. The first key replaces the whole
                // selection at once.
                function select() {
                    view.state = 'typewriter-retype--selecting';
                    timer = setTimeout(() => {
                        length = 0;
                        letters.clear();
                        view.retyped = true;
                        word = (word + 1) % words.length;
                        key();
                    }, SELECTED_FOR);
                }

                timer = setTimeout(select, HOLD);
            },
            ondisconnect: () => {
                clearTimeout(timer);
                // Back to the word as rendered, so a remount starts clean instead of from a half typed, selected word.
                letters.clear();
                view.retyped = false;
                view.state = '';
            }
        }}>
            <span class='typewriter-retype-sr'>${`${lead}${new Intl.ListFormat('en', { type: 'disjunction' }).format(words)}.`}</span>
            <span aria-hidden='true' class='typewriter-retype-sizer'>${`${lead}${longest}`}</span>
            <span aria-hidden='true' class='typewriter-retype-line'>
                ${lead}
                <span class='typewriter-retype-word'>${() => !view.retyped && (words[0] ?? '')}${html.reactive(letters, (char) => html`<span class='typewriter-retype-letter'>${char}</span>`)}</span>
            </span>
        </span>
    `;
};
