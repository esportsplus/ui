import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { factory } from '~/components/checkbox';
import form from '~/components/form';
import input from '~/components/input';
import radio from '~/components/radio';
import './scss/index.scss';


type A = Attributes & {
    [MULTI_STEP_FORM_INPUT]?: Parameters<typeof input>[0];
    oncreate?: (value: { name: string, plan: string }) => void;
    plans?: Plan[];
    state?: State;
};

type Plan = { id: string, name: string, note: string, price: string };

type State = { name: string, panel: number, plan: string };


const DEFAULT_PLANS: Plan[] = [
    { id: 'hobby', name: 'Hobby', note: 'One project, community support', price: 'Free' },
    { id: 'pro', name: 'Pro', note: 'Unlimited projects, analytics', price: '$12/mo' },
    { id: 'team', name: 'Team', note: 'Shared billing and roles', price: '$36/mo' }
];

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const LABELS = ['Continue', 'Create', 'Start over'];

const MULTI_STEP_FORM_INPUT = Symbol.for('@esportsplus/ui/multi-step-form.input');

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// Far enough to read as direction, short enough to stay a nudge, not a pan.
const SHIFT = 36;

const STEPS = ['Name', 'Plan', 'Review'];


function check() {
    return html`<svg aria-hidden='true' class='multi-step-form-done-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='m3.5 8.5 3 3 6-7' /></svg>`;
}

function template(
    this: { attributes?: Partial<A> } | void,
    { oncreate, plans = DEFAULT_PLANS, state, ...attributes }: A = {}
) {
    let body: HTMLElement | undefined,
        defaults = this?.attributes,
        elements: HTMLElement[] = [],
        observer: ResizeObserver | undefined,
        prefix = `multi-step-form-${Math.random().toString(36).slice(2, 8)}`,
        s = state || reactive({ name: '', panel: 0, plan: '' });

    function advance() {
        if (!valid()) {
            return;
        }

        if (s.panel < 2) {
            go(s.panel + 1, 1);
        }
        else if (s.panel === 2) {
            go(3, 1);
            oncreate?.({ name: s.name.trim(), plan: s.plan });
        }
        else {
            s.name = '';
            s.plan = '';
            go(0, -1);
        }
    }

    function footer(ghost: boolean) {
        return html`
            <div class='multi-step-form-footer'>
                <button
                    class='button multi-step-form-back'
                    type='button'
                    ${{
                        disabled: () => ghost || s.panel === 0 || s.panel === 3,
                        onclick: () => {
                            if (s.panel === 1 || s.panel === 2) {
                                go(s.panel - 1, -1);
                            }
                        }
                    }}
                >
                    Back
                </button>
                <button class='button multi-step-form-submit' type='submit' ${{ disabled: () => ghost || !valid() }}>
                    <span class='multi-step-form-labels'>
                        ${LABELS.map((label) => html`
                            <span
                                class='multi-step-form-label'
                                ${{
                                    'aria-hidden': () => String(label !== primary()),
                                    class: () => label === primary() && '--active'
                                }}
                            >
                                ${label}
                            </span>
                        `)}
                    </span>
                </button>
            </div>
        `;
    }

    function go(next: number, direction: 1 | -1) {
        let from = elements[s.panel],
            reduce = matchMedia(REDUCED_MOTION).matches,
            to = elements[next];

        s.panel = next;

        if (from && from !== to) {
            for (let animation of from.getAnimations()) {
                animation.cancel();
            }

            from.dataset.exiting = '';
            from.inert = true;

            let exit = from.animate(
                reduce
                    ? { opacity: [1, 0] }
                    : { filter: ['blur(0px)', 'blur(4px)'], opacity: [1, 0], transform: ['none', `translateX(${direction * -SHIFT * 0.7}px)`] },
                { duration: reduce ? 120 : 150, easing: EASE_OUT, fill: 'forwards' }
            );

            exit.onfinish = () => {
                delete from.dataset.exiting;
                exit.cancel();
            };
        }

        if (!to) {
            return;
        }

        for (let animation of to.getAnimations()) {
            animation.cancel();
        }

        delete to.dataset.exiting;
        to.inert = false;
        to.animate(
            reduce
                ? { opacity: [0, 1] }
                : { filter: ['blur(4px)', 'blur(0px)'], opacity: [0, 1], transform: [`translateX(${direction * SHIFT}px)`, 'none'] },
            { duration: reduce ? 200 : 300, easing: EASE_OUT }
        );

        // Move focus into the new step so keyboard and screen reader users land where the change happened, once it is displayed.
        requestAnimationFrame(() => {
            (to.querySelector<HTMLElement>('input:checked, [data-autofocus]') ?? to.querySelector<HTMLElement>('input'))?.focus({ preventScroll: true });
        });
    }

    function header() {
        return html`
            <div class='multi-step-form-header'>
                <span class='multi-step-form-step'>${() => s.panel < 3 ? `Step ${s.panel + 1} of 3` : 'Complete'}</span>
                <div class='multi-step-form-progress' aria-hidden='true'>
                    ${STEPS.map((_, i) => html`
                        <span class='multi-step-form-bar' ${{ class: () => i <= s.panel && '--active' }}></span>
                    `)}
                </div>
            </div>
        `;
    }

    function heading(title: string, note: string, focusable = false) {
        return html`
            <div class='multi-step-form-heading'>
                <h3 class='multi-step-form-title' ${focusable ? { 'data-autofocus': '', tabindex: '-1' } : {}}>${title}</h3>
                <p class='multi-step-form-note'>${note}</p>
            </div>
        `;
    }

    function name() {
        return s.name.trim() || 'Untitled';
    }

    function panel(index: number, ghost: boolean) {
        let content;

        if (index === 0) {
            content = html`
                ${heading('Name your workspace', 'You can change this later.')}
                ${input({
                    'aria-label': 'Workspace name',
                    autocomplete: 'organization',
                    class: 'multi-step-form-input',
                    'data-autofocus': '',
                    name: 'name',
                    oninput: (e: Event) => {
                        s.name = (e.target as HTMLInputElement).value;
                    },
                    placeholder: 'Acme Inc',
                    value: () => s.name,
                    ...defaults?.[MULTI_STEP_FORM_INPUT],
                    ...attributes[MULTI_STEP_FORM_INPUT]
                })}
            `;
        }
        else if (index === 1) {
            content = html`
                ${heading('Choose a plan', 'Switch any time from settings.')}
                <div aria-label='Plan' class='multi-step-form-plans' role='radiogroup'>
                    ${plans.map((plan) => html`
                        <label class='multi-step-form-plan' ${{ class: () => s.plan === plan.id && '--active' }}>
                            ${radio({
                                class: 'multi-step-form-radio',
                                [factory.input]: {
                                    checked: () => s.plan === plan.id,
                                    name: `${prefix}${ghost ? '-ghost' : ''}-plan`,
                                    onchange: () => {
                                        s.plan = plan.id;
                                    },
                                    value: plan.id
                                }
                            })}
                            <span class='multi-step-form-plan-text'>
                                <span class='multi-step-form-plan-name'>${plan.name}</span>
                                <span class='multi-step-form-plan-note'>${plan.note}</span>
                            </span>
                            <span class='multi-step-form-plan-price'>${plan.price}</span>
                        </label>
                    `)}
                </div>
            `;
        }
        else if (index === 2) {
            content = html`
                ${heading('Review', 'Check the details, then create.', true)}
                <dl class='multi-step-form-review'>
                    ${[
                        ['Name', name],
                        ['Plan', () => selected()?.name ?? 'None'],
                        ['Billed', () => selected()?.price ?? 'Free']
                    ].map(([term, value]) => html`
                        <div class='multi-step-form-review-row'>
                            <dt>${term}</dt>
                            <dd>${value}</dd>
                        </div>
                    `)}
                </dl>
            `;
        }
        else {
            content = html`
                ${check()}
                <div class='multi-step-form-done-text'>
                    <h3 class='multi-step-form-title' data-autofocus tabindex='-1'>Workspace created</h3>
                    <p class='multi-step-form-note'>${() => `${name()} is ready on ${selected()?.name ?? 'Hobby'}.`}</p>
                </div>
            `;
        }

        return html`
            <div
                class='multi-step-form-panel ${index === 3 && 'multi-step-form-panel--done'}'
                ${ghost ? {} : {
                    class: () => s.panel === index && '--active',
                    onrender: (element: HTMLElement) => {
                        elements[index] = element;
                    }
                }}
            >
                ${content}
            </div>
        `;
    }

    function primary() {
        return s.panel === 2 ? LABELS[1] : s.panel === 3 ? LABELS[2] : LABELS[0];
    }

    function selected() {
        return plans.find((plan) => plan.id === s.plan);
    }

    function valid() {
        return s.panel === 0 ? s.name.trim().length >= 2 : s.panel === 1 ? !!selected() : true;
    }

    // The card grows up from a fixed bottom so Back and Continue never move under the cursor; the invisible copy holding every step reserves the tallest height.
    return html`
        <div class='multi-step-form' ${defaults} ${attributes}>
            <div class='multi-step-form-ghost' aria-hidden='true' inert>
                ${header()}
                <div class='multi-step-form-stack'>
                    ${[0, 1, 2, 3].map((index) => panel(index, true))}
                </div>
                ${footer(true)}
            </div>

            ${form.action({
                action: () => {
                    advance();

                    return { errors: [] };
                },
                'aria-label': 'Create a workspace',
                class: 'multi-step-form-card',
                novalidate: true,
                onkeydown: (e: KeyboardEvent) => {
                    // Enter submits the step from any field, radios included, which browsers disagree on; buttons keep their own Enter.
                    if (e.key !== 'Enter' || e.isComposing || (e.target as HTMLElement).tagName === 'BUTTON') {
                        return;
                    }

                    e.preventDefault();
                    advance();
                }
            }, html`
                ${header()}
                <div
                    class='multi-step-form-body'
                    ${{
                        onrender: (element: HTMLElement) => {
                            body = element;
                        }
                    }}
                >
                    <div
                        class='multi-step-form-inner'
                        ${{
                            onconnect: (element: HTMLElement) => {
                                // Measured rather than scaled, so the height is right even when text wraps differently.
                                observer = new ResizeObserver(() => {
                                    if (!body) {
                                        return;
                                    }

                                    body.style.height = `${element.offsetHeight}px`;

                                    if (!body.hasAttribute('data-measured')) {
                                        requestAnimationFrame(() => body?.setAttribute('data-measured', ''));
                                    }
                                });
                                observer.observe(element);
                            },
                            ondisconnect: () => {
                                observer?.disconnect();
                            }
                        }}
                    >
                        ${[0, 1, 2, 3].map((index) => panel(index, false))}
                    </div>
                </div>
                ${footer(false)}
                <span aria-live='polite' class='multi-step-form-live'>
                    ${() => s.panel === 3 ? 'Workspace created' : `Step ${s.panel + 1} of 3, ${STEPS[s.panel]}`}
                </span>
            `)}
        </div>
    `;
}


export default Object.assign(template, { input: MULTI_STEP_FORM_INPUT } as const);
export type { Plan, State };
