import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import { mac } from '~/lib/platform';
import tooltip from '~/components/tooltip';
import chevronUp from '@esportsplus/ui/svg/chevron-up.svg';
import circleCheck from '@esportsplus/ui/svg/circle-check.svg';
import circle from '@esportsplus/ui/svg/circle.svg';
import close from '@esportsplus/ui/svg/close.svg';
import dots from '@esportsplus/ui/svg/dots.svg';
import download from '@esportsplus/ui/svg/download.svg';
import enter from '@esportsplus/ui/svg/enter.svg';
import expand from '@esportsplus/ui/svg/expand.svg';
import listChecks from '@esportsplus/ui/svg/list-checks.svg';
import map from '@esportsplus/ui/svg/map.svg';
import './scss/index.scss';


type A = Attributes & {
    [PLAN_CARD_APPROVE]?: Attributes;
    [PLAN_CARD_VIEW]?: Attributes;
    // Seconds before the plan approves itself; 0 leaves it to the user.
    autoApprove?: number;
    description?: Renderable<unknown>;
    icon?: Renderable<unknown>;
    onapprove?: (auto: boolean) => void;
    ondownload?: VoidFunction;
    onexpand?: VoidFunction;
    onkeydown?: never;
    onview?: VoidFunction;
    // To-dos shown before the rest fold behind "N more".
    peek?: number;
    state?: State;
    title: string;
    todos: Todo[];
};

type State = {
    approved: boolean;
    // Seconds left before auto approval; -1 once cancelled, or when it is off.
    countdown: number;
    expanded: boolean;
};

type Todo = {
    done?: boolean;
    label: string;
};


const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const PLAN_CARD_APPROVE = Symbol.for('@esportsplus/ui/plan-card.approve');

const PLAN_CARD_VIEW = Symbol.for('@esportsplus/ui/plan-card.view');

// Circumference of the countdown ring (r = 7).
const RING = 2 * Math.PI * 7;

// The labels wait a beat under the pointer; keyboard focus shows them at once.
const TOOLTIP_DELAY = 400;


let uid = 0;


function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


const planCard = ({
    autoApprove = 10,
    description,
    icon,
    onapprove,
    ondownload,
    onexpand,
    onview,
    peek = 3,
    state,
    title,
    todos,
    ...attributes
}: A) => {
    let digits: HTMLElement | undefined,
        id = `plan-card-${++uid}`,
        observer: IntersectionObserver | undefined,
        s = state ?? reactive({ approved: false, countdown: autoApprove > 0 ? autoApprove : -1, expanded: false }),
        started = reactive({ value: false }),
        timer: ReturnType<typeof setInterval> | undefined,
        tip = tooltip.shared({ delay: { open: TOOLTIP_DELAY } }),
        total = untrack(() => s.countdown);

    function approve(auto: boolean) {
        if (s.approved) {
            return;
        }

        clearInterval(timer);
        s.approved = true;
        onapprove?.(auto);
    }

    function cancel() {
        clearInterval(timer);
        s.countdown = -1;
    }

    function start() {
        if (started.value || s.approved || s.countdown <= 0) {
            return;
        }

        started.value = true;
        timer = setInterval(() => {
            if (s.countdown <= 0) {
                clearInterval(timer);
                return;
            }

            s.countdown -= 1;

            if (s.countdown === 0) {
                approve(true);
            }
        }, 1000);
    }

    // Only the digits that change roll in, one after another, so 10 → 9 reads as a single tick.
    function write(value: number, animate: boolean) {
        if (!digits) {
            return;
        }

        let reduce = reduced(),
            text = String(Math.max(value, 0));

        while (digits.children.length > text.length) {
            digits.lastElementChild!.remove();
        }

        for (let i = 0, n = text.length; i < n; i++) {
            let span = digits.children[i] as HTMLElement | undefined;

            if (span?.textContent === text[i]) {
                continue;
            }

            let next = document.createElement('span');

            next.className = 'plan-card-digit';
            next.textContent = text[i];

            if (span) {
                span.replaceWith(next);
            }
            else {
                digits.append(next);
            }

            if (animate && !reduce) {
                next.animate(
                    [
                        { filter: 'blur(1.5px)', opacity: 0, translate: '0 -4px' },
                        { filter: 'blur(0px)', opacity: 1, translate: '0 0' }
                    ],
                    { delay: i * 40, duration: 260, easing: EASE_OUT, fill: 'backwards' }
                );
            }
        }
    }

    let hidden = Math.max(todos.length - peek, 0),
        previous: number | undefined,
        // Returns nothing on purpose: an effect's value is a dependency of whatever renders this card, so returning
        // the countdown would re-render that parent on every tick.
        stop = effect(() => {
            let countdown = s.countdown;

            untrack(() => write(countdown, previous !== undefined));
            previous = countdown;
        });

    onCleanup(() => {
        clearInterval(timer);
        observer?.disconnect();
        stop();
    });

    return html`
        <article
            class='plan-card'
            ${attributes}
            ${{
                'aria-labelledby': `${id}-title`,
                class: () => s.approved && '--approved',
                onconnect: (element: HTMLElement) => {
                    if (s.countdown <= 0) {
                        return;
                    }

                    // The clock starts once the card is actually on screen, not while it waits below the fold.
                    observer = new IntersectionObserver((entries) => {
                        if (!entries.some((entry) => entry.isIntersecting)) {
                            return;
                        }

                        observer?.disconnect();
                        start();
                    }, { threshold: 0.5 });
                    observer.observe(element);
                },
                onkeydown: (e: KeyboardEvent) => {
                    if (e.key === 'Enter' && (mac() ? e.metaKey : e.ctrlKey)) {
                        e.preventDefault();
                        approve(false);
                    }
                }
            }}
        >
            <header class='plan-card-header'>
                <span aria-hidden='true' class='plan-card-icon'>
                    ${icon ?? html`<svg><use href='#${map}' /></svg>`}
                </span>
                <h3 class='plan-card-title' id='${id}-title'>${title}</h3>
                ${(ondownload || onexpand) && html`
                    <span class='plan-card-actions'>
                        ${ondownload && html`
                            <button aria-label='Download the plan' class='plan-card-action' type='button' ${tip.bind('Download')} onclick='${ondownload}'>
                                <svg aria-hidden='true'><use href='#${download}' /></svg>
                            </button>
                        `}
                        ${onexpand && html`
                            <button aria-label='Open the full plan' class='plan-card-action' type='button' ${tip.bind('Open')} onclick='${onexpand}'>
                                <svg aria-hidden='true'><use href='#${expand}' /></svg>
                            </button>
                        `}
                    </span>
                `}
            </header>

            ${description && html`<p class='plan-card-description'>${description}</p>`}

            <div aria-labelledby='${id}-todos' class='plan-card-todos' role='group'>
                <div class='plan-card-todos-header'>
                    <svg aria-hidden='true' class='plan-card-todos-icon'><use href='#${listChecks}' /></svg>
                    <span class='plan-card-todos-label' id='${id}-todos'>To-dos</span>
                    <span class='plan-card-todos-count'>${todos.length}</span>
                </div>
                <ul class='plan-card-list' id='${id}-list'>
                    ${todos.map((todo, index) => {
                        let row = html`
                            <div class='plan-card-todo ${todo.done && '--done'}'>
                                <svg aria-hidden='true' class='plan-card-todo-icon'><use href='#${todo.done ? circleCheck : circle}' /></svg>
                                <span class='plan-card-todo-label'>${todo.label}</span>
                            </div>
                        `;

                        if (index < peek) {
                            return html`<li>${row}</li>`;
                        }

                        // Folded rows close to zero height; the grid track animates, so their text never reflows.
                        return html`
                            <li
                                class='plan-card-fold'
                                ${{
                                    class: () => s.expanded && '--active',
                                    inert: () => !s.expanded
                                }}
                            >
                                <div class='plan-card-fold-inner'>${row}</div>
                            </li>
                        `;
                    })}
                    ${hidden > 0 && html`
                        <li>
                            <button
                                class='plan-card-toggle'
                                type='button'
                                ${{
                                    'aria-controls': `${id}-list`,
                                    'aria-expanded': () => String(s.expanded),
                                    class: () => s.expanded && '--active',
                                    onclick: () => {
                                        s.expanded = !s.expanded;
                                    }
                                }}
                            >
                                <span aria-hidden='true' class='plan-card-toggle-icon'>
                                    <svg class='plan-card-toggle-more'><use href='#${dots}' /></svg>
                                    <svg class='plan-card-toggle-less'><use href='#${chevronUp}' /></svg>
                                </span>
                                <span class='plan-card-toggle-labels'>
                                    <span class='plan-card-toggle-label plan-card-toggle-label--more' ${{ 'aria-hidden': () => s.expanded && 'true' }}>${hidden} more</span>
                                    <span class='plan-card-toggle-label plan-card-toggle-label--less' ${{ 'aria-hidden': () => !s.expanded && 'true' }}>Show less</span>
                                </span>
                            </button>
                        </li>
                    `}
                </ul>
            </div>

            <footer class='plan-card-footer'>
                <span
                    aria-live='polite'
                    class='plan-card-status'
                    ${{
                        class: () => s.approved ? '--approved' : s.countdown === -1 && '--cancelled'
                    }}
                >
                    ${() => s.approved
                        ? html`
                            <svg aria-hidden='true' class='plan-card-status-icon'><use href='#${circleCheck}' /></svg>
                            <span>${total > 0 && s.countdown === 0 ? 'Auto-approved' : 'Approved'}</span>
                        `
                        : total > 0 && html`
                            <button
                                aria-label='Cancel auto approval'
                                class='plan-card-cancel'
                                type='button'
                                ${tip.bind('Cancel')}
                                ${{
                                    disabled: () => s.countdown === -1,
                                    onclick: cancel
                                }}
                            >
                                <svg aria-hidden='true' class='plan-card-ring' viewBox='0 0 18 18'>
                                    <circle class='plan-card-ring-track' cx='9' cy='9' r='7' />
                                    <circle
                                        class='plan-card-ring-progress'
                                        cx='9'
                                        cy='9'
                                        r='7'
                                        style='${() => `stroke-dasharray: ${RING}; stroke-dashoffset: ${
                                            // Aims at where the ring will be at the next tick, so it drains through each second.
                                            RING * (1 - Math.max(started.value ? s.countdown - 1 : s.countdown, 0) / total)
                                        }`}'
                                    />
                                </svg>
                                <span aria-hidden='true' class='plan-card-cancel-icon'>
                                    <svg><use href='#${close}' /></svg>
                                </span>
                            </button>
                            <span>
                                Auto Approve in
                                <span
                                    class='plan-card-digits'
                                    ${{
                                        onrender: (element: HTMLElement) => {
                                            digits = element;
                                            write(untrack(() => s.countdown), false);
                                        }
                                    }}
                                ></span>s
                            </span>
                        `}
                </span>

                <span class='plan-card-buttons'>
                    ${onview && html`
                        <button class='plan-card-button plan-card-button--secondary' type='button' ${attributes[PLAN_CARD_VIEW]} onclick='${onview}'>
                            View Plan
                        </button>
                    `}
                    <button
                        class='plan-card-button plan-card-button--primary'
                        type='button'
                        ${attributes[PLAN_CARD_APPROVE]}
                        ${{
                            'aria-keyshortcuts': mac() ? 'Meta+Enter' : 'Control+Enter',
                            disabled: () => s.approved,
                            onclick: () => approve(false)
                        }}
                    >
                        ${() => s.approved ? 'Approved' : 'Approve'}
                        <kbd aria-hidden='true' class='plan-card-kbd'>
                            <kbd>${mac() ? '⌘' : 'Ctrl'}</kbd>
                            <kbd>
                                <svg><use href='#${enter}' /></svg>
                            </kbd>
                        </kbd>
                    </button>
                </span>
            </footer>

            ${tip.render({ 'aria-hidden': 'true', class: 'plan-card-tooltip' })}
        </article>
    `;
};


export default component(planCard, { approve: PLAN_CARD_APPROVE, view: PLAN_CARD_VIEW });
export type { State, Todo };
