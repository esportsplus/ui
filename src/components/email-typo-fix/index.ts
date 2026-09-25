import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import input from '~/components/input';
import './scss/index.scss';


type A = Attributes & {
    [EMAIL_TYPO_FIX_FIELD]?: Field;
    hint?: Renderable<unknown>;
    label?: Renderable<unknown>;
    placeholder?: string;
    state?: State;
    value?: string;
};

type D = Attributes & Pick<A, typeof EMAIL_TYPO_FIX_FIELD>;

type Field = Parameters<typeof input>[0];

type Glyph = {
    char: string;
    key: string;
    kind: 'keep' | 'move' | 'new';
};

type Morph = {
    overlay: HTMLElement;
    timer: ReturnType<typeof setTimeout>;
    to: string;
};

type State = {
    active: boolean;
    error: string;
    // The address a sign-in link (or similar) was sent to; shown in place of the hint until the value changes.
    sent: string;
    value: string;
};


// The domains people actually sign up with, most common first so a tie in distance goes to the likelier one.
const COMMON = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'aol.com',
    'live.com',
    'msn.com',
    'proton.me',
    'protonmail.com',
    'me.com',
    'mac.com',
    'googlemail.com',
    'yandex.com',
    'gmx.com',
    'hey.com',
    'fastmail.com',
    'zoho.com',
    'comcast.net',
    'yahoo.co.uk',
    'hotmail.co.uk'
];

// A pause in typing reads as "done with this bit".
const DEBOUNCE = 900;

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const EMAIL_TYPO_FIX_FIELD = Symbol.for('@esportsplus/ui/email-typo-fix.field');

// Real domains that sit one letter from a common one. Never "correct" them.
const KNOWN = new Set([
    ...COMMON,
    'email.com',
    'gmx.de',
    'gmx.net',
    'hey.co',
    'live.co.uk',
    'mail.com',
    'pm.me',
    'web.de',
    'ymail.com'
]);

// The letters land by ~600ms; the underline under the fixed letters then lingers and fades, ending at 1300ms.
const MORPH_MS = 1300;

const SPRING = {
    duration: 620,
    easing: 'linear(0, 0.036, 0.114, 0.215, 0.321, 0.424, 0.513, 0.597, 0.669, 0.727, 0.779, 0.822, 0.855, 0.884, 0.908, 0.927, 0.941, 0.954, 0.963, 0.971, 0.977, 0.982, 0.986, 0.989, 0.991, 0.993, 0.995, 0.996, 0.997, 0.997, 1)'
};

// Endings that are almost always a slipped .com, .net or .org.
const TLD_SLIPS: Record<string, string> = {
    cim: 'com',
    cmo: 'com',
    comm: 'com',
    con: 'com',
    cpm: 'com',
    ent: 'net',
    ner: 'net',
    nte: 'net',
    ocm: 'com',
    ogr: 'org',
    orh: 'org',
    rog: 'org',
    vom: 'com',
    xom: 'com'
};


let uid = 0;


// The stretch of the suggestion that differs, trimmed of the shared start and end, so a swap underlines both letters.
function difference(from: string, to: string) {
    let end = 0,
        start = 0,
        tail = 0;

    while (start < Math.min(from.length, to.length) && from[start] === to[start]) {
        start++;
    }

    while (tail < Math.min(from.length, to.length) - start && from[from.length - 1 - tail] === to[to.length - 1 - tail]) {
        tail++;
    }

    end = Math.max(start + 1, to.length - tail);

    return { end, start };
}

// Optimal string alignment: Levenshtein plus swapped neighbours, so "hotmial" is one slip from "hotmail", not two.
function distance(a: string, b: string) {
    let d: number[][] = [];

    for (let i = 0; i <= a.length; i++) {
        d.push([]);

        for (let j = 0; j <= b.length; j++) {
            d[i].push(i === 0 ? j : j === 0 ? i : 0);
        }
    }

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));

            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
    }

    return d[a.length][b.length];
}

// Letters in the longest common run stay put, a letter that only changed places slides to its new spot, and the
// rest flip out or in. Keys carry identity across the two arrangements.
function plan(from: string, to: string) {
    let kept = new Map<number, number>(),
        lcs: number[][] = [],
        m = to.length,
        n = from.length;

    for (let i = 0; i <= n; i++) {
        lcs.push(new Array<number>(m + 1).fill(0));
    }

    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            lcs[i][j] = from[i] === to[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }

    for (let i = 0, j = 0; i < n && j < m;) {
        if (from[i] === to[j]) {
            kept.set(j++, i++);
        }
        else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
            i++;
        }
        else {
            j++;
        }
    }

    let after: Glyph[] = [],
        used = new Set(kept.values());

    for (let j = 0; j < m; j++) {
        let char = to[j],
            i = kept.get(j);

        if (i !== undefined) {
            after.push({ char, key: `k${i}`, kind: 'keep' });
            continue;
        }

        let spare = -1;

        for (let k = 0; k < n; k++) {
            if (from[k] === char && !used.has(k)) {
                spare = k;
                break;
            }
        }

        if (spare >= 0) {
            used.add(spare);
            after.push({ char, key: `k${spare}`, kind: 'move' });
        }
        else {
            after.push({ char, key: `n${j}`, kind: 'new' });
        }
    }

    return after;
}

function suggest(email: string): string | null {
    let at = email.lastIndexOf('@');

    if (at < 1) {
        return null;
    }

    let domain = email.slice(at + 1).toLowerCase(),
        local = email.slice(0, at);

    if (domain.length < 4 || !domain.includes('.') || KNOWN.has(domain)) {
        return null;
    }

    let best: string | null = null,
        closest = Infinity;

    for (let i = 0, n = COMMON.length; i < n; i++) {
        let d = distance(domain, COMMON[i]);

        if (d < closest) {
            best = COMMON[i];
            closest = d;
        }
    }

    // Two slips are only believable in a long name; "me.co" is not "mac.com".
    if (best && closest <= (best.length >= 9 ? 2 : 1)) {
        return `${local}@${best}`;
    }

    let dot = domain.lastIndexOf('.'),
        fix = TLD_SLIPS[domain.slice(dot + 1)];

    return fix ? `${local}@${domain.slice(0, dot)}.${fix}` : null;
}


export default Object.assign(
    function(
        this: { attributes?: D } | void,
        {
            hint = 'We will send a sign-in link here.',
            label = 'Work email',
            placeholder = 'you@company.com',
            value = '',
            state = reactive({ active: false, error: '', sent: '', value }),
            ...attributes
        }: A
    ) {
        let control: HTMLElement | undefined,
            dismissed = new Set<string>(),
            id = `email-typo-fix-${++uid}`,
            // `checked` is the last value looked at for typos; typing moves ahead of it, so a half typed "gmail.co" is
            // never flagged mid-word. Starting equal to the value checks a pre-filled address on the first render.
            local = reactive({ checked: state.value, dismissals: 0, morphing: false }),
            morph: Morph | null = null,
            note: HTMLElement | undefined,
            panel = '',
            previous = state.value,
            reduced = matchMedia('(prefers-reduced-motion: reduce)');

        function accept() {
            let field = element(),
                to = suggestion();

            if (!to || !field) {
                return;
            }

            let from = state.value.trim();

            stop();

            // Morph only when the whole address is visible; a scrolled field would put the overlay's letters in the wrong place.
            if (!reduced.matches && field.scrollWidth <= field.clientWidth) {
                animate(from, to);
            }

            state.value = to;
            local.checked = to;

            let target = field;

            requestAnimationFrame(() => {
                target.focus();
                target.setSelectionRange(to.length, to.length);
            });
        }

        function animate(from: string, to: string) {
            let field = element();

            if (!control || !field) {
                return;
            }

            let computed = getComputedStyle(field),
                overlay = document.createElement('span'),
                range = difference(from, to),
                spans = new Map<string, HTMLElement>();

            overlay.ariaHidden = 'true';
            overlay.className = 'email-typo-fix-morph';
            overlay.style.paddingInline = `${parseFloat(computed.paddingLeft) + parseFloat(computed.borderLeftWidth)}px ${parseFloat(computed.paddingRight) + parseFloat(computed.borderRightWidth)}px`;

            for (let i = 0, n = from.length; i < n; i++) {
                let span = glyph(from[i]);

                spans.set(`k${i}`, span);
                overlay.append(span);
            }

            control.append(overlay);
            morph = {
                overlay,
                timer: setTimeout(stop, MORPH_MS),
                to
            };
            local.morphing = true;

            // Two frames: the overlay first paints the old text exactly over the field's, then the letters move.
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (morph?.overlay !== overlay) {
                    return;
                }

                let after = plan(from, to),
                    before = new Map<HTMLElement, number>(),
                    changed = 0,
                    placed = new Set<HTMLElement>();

                for (let [, span] of spans) {
                    before.set(span, span.offsetLeft);
                }

                let exits: HTMLElement[] = [],
                    order: HTMLElement[] = [];

                for (let i = 0, n = after.length; i < n; i++) {
                    let span = spans.get(after[i].key);

                    if (!span || after[i].kind === 'new') {
                        span = glyph(after[i].char);
                    }

                    placed.add(span);
                    order.push(span);
                }

                for (let [, span] of spans) {
                    if (!placed.has(span)) {
                        exits.push(span);
                    }
                }

                // Leaving letters drop out of the flow where they stood, so the rest close up while they flip away.
                for (let i = 0, n = exits.length; i < n; i++) {
                    let span = exits[i];

                    span.style.left = `${before.get(span)}px`;
                    span.classList.add('email-typo-fix-morph-glyph--leaving');
                    span.animate(
                        { opacity: [1, 0], transform: ['perspective(120px) rotateX(0deg)', 'perspective(120px) rotateX(90deg)'], translate: ['0 0', '0 -30%'] },
                        { duration: 160, easing: EASE_OUT, fill: 'forwards' }
                    );
                }

                overlay.replaceChildren(...order, ...exits);

                for (let i = 0, n = after.length; i < n; i++) {
                    let delay = after[i].kind === 'keep' ? 0 : (changed++) * 40,
                        span = order[i];

                    if (i >= range.start && i < range.end) {
                        let underline = document.createElement('span');

                        underline.className = 'email-typo-fix-morph-underline';
                        span.append(underline);
                        underline.animate(
                            [{ opacity: 0 }, { offset: 0.25, opacity: 1 }, { offset: 0.6, opacity: 1 }, { opacity: 0 }],
                            { delay: 240, duration: 1100, easing: 'ease-out', fill: 'both' }
                        );
                    }

                    if (after[i].kind === 'new') {
                        span.animate(
                            { opacity: [0, 1], transform: ['perspective(120px) rotateX(-90deg)', 'perspective(120px) rotateX(0deg)'], translate: ['0 30%', '0 0'] },
                            { ...SPRING, delay, fill: 'backwards' }
                        );
                        continue;
                    }

                    let dx = (before.get(span) ?? span.offsetLeft) - span.offsetLeft;

                    if (dx) {
                        span.animate({ transform: [`translateX(${dx}px)`, 'none'] }, { ...SPRING, delay, fill: 'backwards' });
                    }

                    // A moved letter hops over its neighbour instead of sliding through it.
                    if (after[i].kind === 'move') {
                        span.animate({ translate: ['0 0', '0 -40%', '0 0'] }, { delay, duration: 420, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' });
                    }
                }
            }));
        }

        function dismiss() {
            dismissed.add(state.value.toLowerCase());
            local.dismissals++;
            element()?.focus();
        }

        function element() {
            return control?.querySelector<HTMLInputElement>('.email-typo-fix-field') ?? undefined;
        }

        function glyph(char: string) {
            let span = document.createElement('span');

            span.className = 'email-typo-fix-morph-glyph';
            span.textContent = char;

            return span;
        }

        function show(target: HTMLElement | null | undefined) {
            target?.animate(
                reduced.matches
                    ? { opacity: [0, 1] }
                    : { filter: ['blur(4px)', 'blur(0)'], opacity: [0, 1], translate: ['0 -4px', '0 0'] },
                { duration: 220, easing: EASE_OUT }
            );
        }

        function stop() {
            if (!morph) {
                return;
            }

            clearTimeout(morph.timer);
            morph.overlay.remove();
            morph = null;
            local.morphing = false;
        }

        function suggestion() {
            let value = state.value;

            if (local.checked !== value || (local.dismissals && dismissed.has(value.toLowerCase()))) {
                return null;
            }

            return suggest(value.trim());
        }

        // A keystroke extends or trims the old value; anything else (a paste, autofill, a value set from outside) is a
        // whole new address, checked right away.
        effect(() => {
            let value = state.value;

            untrack(() => {
                if (value === previous) {
                    return;
                }

                let keystroke = Math.abs(value.length - previous.length) <= 1 && (value.startsWith(previous) || previous.startsWith(value));

                previous = value;

                if (!keystroke) {
                    local.checked = value;
                }

                // Replaced from outside mid-morph: drop the overlay so it never paints letters of an address that is gone.
                if (morph && value !== morph.to) {
                    stop();
                }
            });
        });

        effect(() => {
            let checked = local.checked,
                value = state.value;

            if (checked === value) {
                return;
            }

            let timer = setTimeout(() => {
                local.checked = value;
            }, DEBOUNCE);

            onCleanup(() => clearTimeout(timer));
        });

        // One fixed-height slot holds the hint, the suggestion and the sent note, so nothing below ever moves.
        effect(() => {
            let next = suggestion() ? 'suggest' : state.sent ? `sent-${state.sent}` : 'hint';

            untrack(() => {
                if (panel && panel !== next) {
                    show(next === 'suggest' ? note?.querySelector<HTMLElement>('.email-typo-fix-suggest') : note?.querySelector<HTMLElement>('.email-typo-fix-hint'));
                }

                panel = next;
            });
        });

        onCleanup(() => {
            clearTimeout(morph?.timer);
        });

        return html`
            <div
                class='email-typo-fix'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => local.morphing && '--morphing'
                }}
            >
                <label class='email-typo-fix-label' for='${id}'>${label}</label>
                <div class='email-typo-fix-control' ${{ onrender: (element: HTMLElement) => { control = element; } }}>
                    ${input.call({ attributes: { ...this?.attributes?.[EMAIL_TYPO_FIX_FIELD], ...attributes[EMAIL_TYPO_FIX_FIELD] } }, {
                        'aria-describedby': `${id}-note`,
                        autocapitalize: 'none',
                        autocomplete: 'email',
                        class: 'email-typo-fix-field',
                        id,
                        inputmode: 'email',
                        onblur: () => {
                            local.checked = state.value;
                        },
                        oninput: (e: Event) => {
                            stop();
                            state.sent = '';
                            state.value = (e.currentTarget as HTMLInputElement).value;
                        },
                        placeholder,
                        spellcheck: false,
                        state,
                        // Text, not email: email inputs refuse setSelectionRange, and the caret has to land at the end after a fix.
                        type: 'text',
                        value: () => state.value
                    })}
                </div>
                <div
                    aria-live='polite'
                    class='email-typo-fix-note'
                    id='${id}-note'
                    ${{ onrender: (element: HTMLElement) => { note = element; } }}
                >
                    <div class='email-typo-fix-suggest ${() => suggestion() && '--active'}' inert=${() => !suggestion()}>
                        <button class='email-typo-fix-accept' onclick=${accept} type='button'>
                            <span class='email-typo-fix-accept-text'>
                                Did you mean
                                <span class='email-typo-fix-address'>${() => {
                                    let to = suggestion();

                                    if (!to) {
                                        return '';
                                    }

                                    let { end, start } = difference(state.value.trim(), to);

                                    return html`${to.slice(0, start)}<span class='email-typo-fix-address-fix'>${to.slice(start, end)}</span>${to.slice(end)}`;
                                }}</span>?
                            </span>
                        </button>
                        <button
                            aria-label=${() => `No, keep ${state.value.trim()}`}
                            class='email-typo-fix-dismiss'
                            onclick=${dismiss}
                            type='button'
                        >
                            <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                <path d='m4.5 4.5 7 7M11.5 4.5l-7 7' />
                            </svg>
                        </button>
                    </div>
                    <p class='email-typo-fix-hint ${() => !suggestion() && '--active'}'>
                        <span class='email-typo-fix-hint-text'>
                            ${() => state.sent ? html`Link sent to <span class='email-typo-fix-address'>${state.sent}</span>.` : hint}
                        </span>
                    </p>
                </div>
            </div>
        `;
    },
    { field: EMAIL_TYPO_FIX_FIELD, suggest } as const
);
