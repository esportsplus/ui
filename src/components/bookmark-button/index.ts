import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [BOOKMARK_BUTTON_ICON]?: Attributes;
    count?: number;
    label?: string;
    onclick?: never;
    onconnect?: never;
    ondisconnect?: never;
    onsave?: (saved: boolean) => void;
    savedLabel?: string;
    state?: State;
};

type State = { saved: boolean };


const BOOKMARK_BUTTON_ICON = Symbol.for('@esportsplus/ui/bookmark-button.icon');

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

// Lifts and stretches, then lands with a squash as the fill tops out; kept
// within 0.95 to 1.05 so it reads as weight, not rubber.
const LAND: Keyframe[] = [
    { easing: 'ease-out', scale: '1 1', translate: '0 0' },
    { easing: 'ease-in', offset: 0.35, scale: '0.97 1.04', translate: '0 -2px' },
    { easing: 'ease-out', offset: 0.65, scale: '1.04 0.95', translate: '0 1px' },
    { scale: '1 1', translate: '0 0' }
];

const SPRING = 'linear(0, 0.057, 0.18, 0.321, 0.455, 0.573, 0.671, 0.75, 0.812, 0.86, 0.896, 0.924, 0.944, 0.96, 0.971, 0.979, 0.985, 0.989, 0.992, 0.994, 0.996, 0.997, 0.998, 0.999, 1)';


let uid = 0;


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function roll(container: HTMLElement, value: number, previous: number) {
    let blur = reduced() ? 'blur(0px)' : 'blur(4px)',
        direction = value > previous ? 1 : -1,
        next = document.createElement('span'),
        shift = reduced() ? 0 : 6;

    for (let child of [...container.children] as HTMLElement[]) {
        child.classList.add('bookmark-button-count-value--leaving');
        child.animate(
            [{}, { filter: blur, opacity: 0, translate: `0 ${(-direction * shift) / 2}px` }],
            { duration: 120, easing: EASE_OUT, fill: 'forwards' }
        ).finished.then(() => child.remove(), () => child.remove());
    }

    next.className = 'bookmark-button-count-value';
    next.textContent = String(value);
    container.append(next);
    next.animate(
        [{ filter: blur, opacity: 0, translate: `0 ${direction * shift}px` }, { filter: 'blur(0px)', opacity: 1, translate: '0 0' }],
        { duration: 300, easing: SPRING }
    );
}


export default Object.assign(
    function(this: { attributes?: A } | void, { count, label = 'Save', onsave, savedLabel = 'Saved', state = reactive({ saved: false }), ...attributes }: A = {}) {
        let icon: Animation | undefined,
            id = `bookmark-button-${++uid}`,
            live = reactive({ note: '' }),
            stop: VoidFunction | undefined,
            total = () => (count ?? 0) + (state.saved ? 1 : 0);

        function toggle(this: HTMLElement) {
            let element = this.querySelector<HTMLElement>('.bookmark-button-icon'),
                next = !state.saved;

            state.saved = next;
            live.note = next ? 'Saved' : 'Removed from saved';
            onsave?.(next);

            if (!element || reduced()) {
                return;
            }

            if (next) {
                icon?.cancel();
                icon = element.animate(LAND, { duration: 400 });
                return;
            }

            // Unsaving cancels any bounce still in flight and settles fast.
            let { scale, translate } = getComputedStyle(element);

            icon?.cancel();
            icon = element.animate(
                [{ scale, translate }, { scale: '1 1', translate: '0 0' }],
                { duration: 150, easing: EASE_OUT }
            );
        }

        return html`
            <button
                class='button bookmark-button'
                type='button'
                ${this?.attributes}
                ${attributes}
                ${{
                    'aria-describedby': count === undefined ? undefined : `${id}-count`,
                    'aria-label': label,
                    'aria-pressed': () => state.saved ? 'true' : 'false',
                    class: () => state.saved && '--active',
                    onclick: toggle,
                    onconnect: (element: HTMLElement) => {
                        let container = element.querySelector<HTMLElement>('.bookmark-button-count-values'),
                            previous = total();

                        if (!container) {
                            return;
                        }

                        stop = effect(() => {
                            let value = total();

                            if (value !== previous) {
                                roll(container, value, previous);
                                previous = value;
                            }
                        });
                    },
                    ondisconnect: () => {
                        icon?.cancel();
                        stop?.();
                    }
                }}
            >
                <span
                    aria-hidden='true'
                    class='bookmark-button-icon'
                    ${this?.attributes?.[BOOKMARK_BUTTON_ICON]}
                    ${attributes[BOOKMARK_BUTTON_ICON]}
                >
                    <svg class='bookmark-button-outline' viewBox='0 0 24 24'>
                        <path d='M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75v15.07a.5.5 0 0 1-.79.41L12 16.75l-4.71 3.48a.5.5 0 0 1-.79-.41Z' />
                    </svg>
                    <svg class='bookmark-button-fill' viewBox='0 0 24 24'>
                        <path d='M6.5 4.75A1.75 1.75 0 0 1 8.25 3h7.5a1.75 1.75 0 0 1 1.75 1.75v15.07a.5.5 0 0 1-.79.41L12 16.75l-4.71 3.48a.5.5 0 0 1-.79-.41Z' />
                    </svg>
                </span>

                ${count === undefined
                    ? html`
                        <span aria-hidden='true' class='bookmark-button-labels'>
                            <span class='bookmark-button-label bookmark-button-label--idle'>${label}</span>
                            <span class='bookmark-button-label bookmark-button-label--saved'>${savedLabel}</span>
                        </span>
                    `
                    : html`
                        <span class='bookmark-button-count'>
                            <span class='bookmark-button-live' id='${id}-count'>${() => `${total()} saves`}</span>
                            <span aria-hidden='true' class='bookmark-button-count-values'>
                                <span class='bookmark-button-count-value'>${total()}</span>
                            </span>
                        </span>
                    `}

                <span aria-live='polite' class='bookmark-button-live'>${() => live.note}</span>
            </button>
        `;
    },
    { icon: BOOKMARK_BUTTON_ICON } as const
);
