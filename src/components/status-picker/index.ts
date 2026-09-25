import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [STATUS_PICKER_MENU]?: Attributes;
    [STATUS_PICKER_TRIGGER]?: Attributes;
    initials: string;
    name: string;
    state?: { active: boolean, highlight: number, status: Status };
    status?: Status;
    statuses?: Option[];
};

type Option = {
    hint?: string;
    id: Status;
    label: string;
};

type Status = 'away' | 'dnd' | 'invisible' | 'online';


const FADE: KeyframeAnimationOptions = {
    duration: 200,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)'
};

const STATUSES: Option[] = [
    { id: 'online', label: 'Online' },
    { id: 'away', label: 'Away' },
    { hint: 'Mutes notifications', id: 'dnd', label: 'Do not disturb' },
    { hint: 'Appear offline', id: 'invisible', label: 'Invisible' }
];

const STATUS_PICKER_MENU = Symbol.for('@esportsplus/ui/status-picker.menu');

const STATUS_PICKER_TRIGGER = Symbol.for('@esportsplus/ui/status-picker.trigger');

const TURN: KeyframeAnimationOptions = {
    duration: 450,
    easing: 'linear(0, 0.063, 0.204, 0.374, 0.54, 0.685, 0.801, 0.889, 0.95, 0.99, 1.013, 1.025, 1.028, 1.027, 1.023, 1.019, 1.014, 1.01, 1.006, 1.003, 1.002, 1, 1, 0.999, 1)'
};


let uid = 0;


// Each status has its own shape, not just its own colour, so it reads at a glance and for colour-blind eyes too.
function badge(status: Status) {
    switch (status) {
        case 'away':
            return html`
                <svg aria-hidden='true' class='status-picker-icon status-picker-icon--away' viewBox='0 0 12 12'>
                    <path d='M6.6 1.05A5 5 0 1 0 10.95 5.4 4 4 0 0 1 6.6 1.05Z' />
                </svg>
            `;
        case 'dnd':
            return html`
                <svg aria-hidden='true' class='status-picker-icon status-picker-icon--dnd' viewBox='0 0 12 12'>
                    <circle cx='6' cy='6' r='5' />
                    <rect height='1.8' rx='0.9' width='6' x='3' y='5.1' />
                </svg>
            `;
        case 'invisible':
            return html`
                <svg aria-hidden='true' class='status-picker-icon status-picker-icon--invisible' viewBox='0 0 12 12'>
                    <circle cx='6' cy='6' r='3.9' />
                </svg>
            `;
        default:
            return html`
                <svg aria-hidden='true' class='status-picker-icon status-picker-icon--online' viewBox='0 0 12 12'>
                    <circle cx='6' cy='6' r='5' />
                </svg>
            `;
    }
}

function template(
    this: { attributes?: Pick<A, typeof STATUS_PICKER_MENU | typeof STATUS_PICKER_TRIGGER> } | void,
    {
        initials,
        name,
        status = 'online',
        statuses = STATUSES,
        state = reactive({ active: false, highlight: 0, status }),
        ...attributes
    }: A
) {
    let badges = new Map<Status, HTMLElement>(),
        id = `status-picker-${++uid}`,
        items: HTMLElement[] = [],
        keys = false,
        labels = new Map<Status, HTMLElement>(),
        previous = state.status,
        trigger: HTMLElement | undefined;

    function choose(next: Status) {
        state.status = next;
        hide();
    }

    function current() {
        return statuses.find((option) => option.id === state.status) ?? statuses[0];
    }

    function hide() {
        state.active = false;

        if (keys) {
            trigger?.focus();
        }
    }

    // Arrows walk the items whether focus already reached the menu or is still on the trigger.
    function move(e: KeyboardEvent) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
            return false;
        }

        let n = statuses.length;

        e.preventDefault();
        state.highlight = (state.highlight + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
        items[state.highlight]?.focus();

        return true;
    }

    function show() {
        let index = Math.max(0, statuses.findIndex((option) => option.id === state.status));

        state.highlight = index;
        state.active = true;

        // The menu turns visible on the next frame, once its class is applied.
        if (keys) {
            requestAnimationFrame(() => items[index]?.focus());
        }
    }

    // The new badge spins in and the new label rises in; their outgoing counterparts leave through CSS.
    let dispose = effect(() => {
        let next = state.status;

        if (next === previous) {
            return;
        }

        previous = next;

        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        badges.get(next)?.animate([
            { opacity: 0, rotate: '120deg', scale: '0.3' },
            { opacity: 1, rotate: '0deg', scale: '1' }
        ], TURN);
        labels.get(next)?.animate([
            { filter: 'blur(3px)', opacity: 0, translate: '0 4px' },
            { filter: 'blur(0px)', opacity: 1, translate: '0 0' }
        ], FADE);
    });

    onCleanup(dispose);

    return html`
        <div
            class='status-picker'
            ${this?.attributes}
            ${attributes}
            ${{
                class: () => state.active && '--active',
                ondocumentpointerdown: function(this: HTMLElement, e: PointerEvent) {
                    if (state.active && !this.contains(e.target as Node | null)) {
                        state.active = false;
                    }
                }
            }}
        >
            <button
                aria-controls='${id}-menu'
                aria-haspopup='menu'
                class='status-picker-trigger'
                type='button'
                ${this?.attributes?.[STATUS_PICKER_TRIGGER]}
                ${attributes[STATUS_PICKER_TRIGGER]}
                ${{
                    'aria-expanded': () => state.active ? 'true' : 'false',
                    'aria-label': () => `${name}, ${current().label}. Change status`,
                    onclick: (e: MouseEvent) => {
                        keys = e.detail === 0;

                        if (state.active) {
                            hide();
                        }
                        else {
                            show();
                        }
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        keys = true;

                        if (state.active) {
                            if (!move(e) && e.key === 'Escape') {
                                e.preventDefault();
                                hide();
                            }
                        }
                        else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            show();
                        }
                    },
                    onrender: (element: HTMLElement) => {
                        trigger = element;
                    }
                }}
            >
                <span class='status-picker-avatar'>
                    <span class='status-picker-initials'>${initials}</span>
                    <span class='status-picker-slot'>
                        ${statuses.map((option) => html`
                            <span
                                class='status-picker-badge'
                                ${{
                                    class: () => state.status === option.id && '--active',
                                    onrender: (element: HTMLElement) => {
                                        badges.set(option.id, element);
                                    }
                                }}
                            >
                                ${badge(option.id)}
                            </span>
                        `)}
                    </span>
                </span>
                <span class='status-picker-text'>
                    <span class='status-picker-name'>${name}</span>
                    <span class='status-picker-status'>
                        ${statuses.map((option) => html`
                            <span
                                class='status-picker-status-label'
                                ${{
                                    class: () => state.status === option.id && '--active',
                                    onrender: (element: HTMLElement) => {
                                        labels.set(option.id, element);
                                    }
                                }}
                            >
                                ${option.label}
                            </span>
                        `)}
                    </span>
                </span>
            </button>
            <div
                aria-label='Set status'
                class='status-picker-menu'
                id='${id}-menu'
                role='menu'
                ${this?.attributes?.[STATUS_PICKER_MENU]}
                ${attributes[STATUS_PICKER_MENU]}
                ${{
                    inert: () => !state.active,
                    onkeydown: (e: KeyboardEvent) => {
                        keys = true;

                        if (move(e)) {
                            return;
                        }

                        if (e.key === 'Escape' || e.key === 'Tab') {
                            e.preventDefault();
                            hide();
                        }
                    }
                }}
            >
                ${statuses.map((option, index) => html`
                    <button
                        class='status-picker-item'
                        role='menuitemradio'
                        type='button'
                        ${{
                            'aria-checked': () => state.status === option.id ? 'true' : 'false',
                            class: () => state.highlight === index && '--highlighted',
                            onclick: (e: MouseEvent) => {
                                keys = e.detail === 0;
                                choose(option.id);
                            },
                            onpointermove: () => {
                                if (state.highlight !== index) {
                                    state.highlight = index;
                                }
                            },
                            onrender: (element: HTMLElement) => {
                                items[index] = element;
                            },
                            tabIndex: () => state.highlight === index ? 0 : -1
                        }}
                    >
                        <span class='status-picker-item-badge'>${badge(option.id)}</span>
                        <span class='status-picker-item-text'>
                            <span class='status-picker-item-label'>${option.label}</span>
                            ${option.hint ? html`<span class='status-picker-item-hint'>${option.hint}</span>` : ''}
                        </span>
                        <svg aria-hidden='true' class='status-picker-check' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 16 16'>
                            <path d='M3.5 8.25l3 3 6-6.5' />
                        </svg>
                    </button>
                `)}
            </div>
        </div>
    `;
}


export default Object.assign(template, { menu: STATUS_PICKER_MENU, trigger: STATUS_PICKER_TRIGGER } as const);
export type { Option, Status };
