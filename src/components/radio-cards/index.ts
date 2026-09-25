import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { factory } from '~/components/checkbox';
import radio from '~/components/radio';
import './scss/index.scss';


type A = Attributes & {
    [RADIO_CARDS_CARD]?: Attributes;
    [RADIO_CARDS_INPUT]?: Input;
    label: string;
    name?: string;
    options: Option[];
    state?: { error: string, value: string };
    value?: string;
};

// The radio's own input part: no 'onrender' or 'type', since the radio owns both.
type Input = NonNullable<NonNullable<Parameters<typeof radio>[0]>[typeof factory.input]>;

type Option = {
    badge?: string;
    description: string;
    period?: string;
    price: string;
    title: string;
    value: string;
};


const RADIO_CARDS_CARD = Symbol.for('@esportsplus/ui/radio-cards.card');

const RADIO_CARDS_INPUT = Symbol.for('@esportsplus/ui/radio-cards.input');

const RING: KeyframeAnimationOptions = {
    duration: 300,
    easing: 'linear(0, 0.058, 0.18, 0.321, 0.455, 0.573, 0.671, 0.75, 0.812, 0.86, 0.897, 0.924, 0.944, 0.96, 0.971, 0.979, 0.985, 0.989, 0.992, 0.994, 0.996, 0.997, 0.998, 0.999, 1)'
};


let uid = 0;


// The ring only exists in the checked card; sliding it from the previous card's ring is a FLIP.
function glide(grid: HTMLElement, previous: DOMRect | undefined) {
    let ring = grid.querySelector<HTMLElement>('.radio-cards-card:has(input:checked) .radio-cards-ring');

    if (!previous || !ring || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    let next = ring.getBoundingClientRect(),
        x = previous.left - next.left,
        y = previous.top - next.top;

    if (x === 0 && y === 0) {
        return;
    }

    ring.animate([
        { translate: `${x}px ${y}px` },
        { translate: '0px 0px' }
    ], RING);
}

function template(
    this: { attributes?: Pick<A, typeof RADIO_CARDS_CARD | typeof RADIO_CARDS_INPUT> } | void,
    {
        label,
        name,
        options,
        value,
        state = reactive({ error: '', value: value ?? options[0]?.value ?? '' }),
        ...attributes
    }: A
) {
    let group = name ?? `radio-cards-${++uid}`,
        previous: DOMRect | undefined;

    return html`
        <fieldset class='radio-cards' ${this?.attributes} ${attributes}>
            <legend class='radio-cards-legend'>${label}</legend>
            <div
                class='radio-cards-grid'
                ${{
                    onpointerdown: function(this: HTMLElement) {
                        previous = this.querySelector('.radio-cards-card:has(input:checked) .radio-cards-ring')?.getBoundingClientRect();
                    }
                }}
            >
                ${options.map((option) => html`
                    <label class='radio-cards-card' ${this?.attributes?.[RADIO_CARDS_CARD]} ${attributes[RADIO_CARDS_CARD]}>
                        <span aria-hidden='true' class='radio-cards-ring'></span>
                        <span class='radio-cards-dot'>
                            ${radio({
                                state,
                                [factory.input]: {
                                    checked: () => state.value === option.value,
                                    name: group,
                                    onchange: function(this: HTMLInputElement) {
                                        let grid = this.closest<HTMLElement>('.radio-cards-grid');

                                        state.value = option.value;

                                        if (grid) {
                                            glide(grid, previous);
                                        }

                                        previous = undefined;
                                    },
                                    onkeydown: function(this: HTMLInputElement) {
                                        previous = this.closest('.radio-cards-grid')
                                            ?.querySelector('.radio-cards-card:has(input:checked) .radio-cards-ring')
                                            ?.getBoundingClientRect();
                                    },
                                    value: option.value,
                                    ...this?.attributes?.[RADIO_CARDS_INPUT],
                                    ...attributes[RADIO_CARDS_INPUT]
                                }
                            })}
                            <svg aria-hidden='true' class='radio-cards-check' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 16 16'>
                                <path d='m3.5 8.5 3 3 6-7' />
                            </svg>
                        </span>
                        <span class='radio-cards-content'>
                            <span class='radio-cards-heading'>
                                <span class='radio-cards-title'>${option.title}</span>
                                ${option.badge ? html`<span class='radio-cards-badge'>${option.badge}</span>` : ''}
                            </span>
                            <span class='radio-cards-description'>${option.description}</span>
                        </span>
                        <span class='radio-cards-price'>
                            <span class='radio-cards-amount'>${option.price}</span>
                            ${option.period ? html`<span class='radio-cards-period'>${option.period}</span>` : ''}
                        </span>
                    </label>
                `)}
            </div>
        </fieldset>
    `;
}


export default Object.assign(template, { card: RADIO_CARDS_CARD, input: RADIO_CARDS_INPUT } as const);
export type { Option };
