import { html, type Attributes } from '@esportsplus/template';
import { reactive, untrack } from '@esportsplus/reactivity';
import accordion from '~/components/accordion';
import checkbox, { factory } from '~/components/checkbox';
import './scss/index.scss';


type A = Attributes & {
    [ONBOARDING_CHECKLIST_TASK]?: Attributes;
    done?: string[];
    ondismiss?: VoidFunction;
    open?: string[];
    state?: State;
    tasks: Task[];
};

type State = { celebrating: boolean, count: number };

type Task = {
    action: string;
    description: string;
    id: string;
    title: string;
};


// Lets the last check and the ring reaching 100 land before the card changes, so the finish is seen rather than skipped.
const CELEBRATE_AFTER = 700;

const ONBOARDING_CHECKLIST_TASK = Symbol.for('@esportsplus/ui/onboarding-checklist.task');

// Critically damped spring (motion's visualDuration 0.5, bounce 0): slow enough to watch the number count up, never past 100.
const STIFFNESS = (2 * Math.PI / 0.6) ** 2;

const DAMPING = 2 * Math.sqrt(STIFFNESS);


function check() {
    return html`<svg aria-hidden='true' class='onboarding-checklist-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='m3.5 8.5 3 3 6-7' /></svg>`;
}

function template(
    this: { attributes?: Partial<A> } | void,
    { done = [], ondismiss, open = [], state, tasks, ...attributes }: A
) {
    let celebration = reactive({ active: false }),
        // Seeded from the plain inputs: reading the reactive rows here would subscribe whichever effect renders this component.
        count = tasks.filter((task) => done.includes(task.id)).length,
        defaults = this?.attributes,
        frame = 0,
        list = reactive({ active: true }),
        prefix = `onboarding-checklist-${Math.random().toString(36).slice(2, 8)}`,
        rows = tasks.map((task) => reactive({ active: open.includes(task.id), done: done.includes(task.id) })),
        s = state || reactive({ celebrating: false, count }),
        timer: ReturnType<typeof setTimeout> | undefined,
        ui = reactive({ announcement: '', shown: count / tasks.length }),
        velocity = 0;

    s.count = count;

    function celebrate() {
        clearTimeout(timer);

        if (s.count !== tasks.length) {
            return;
        }

        timer = setTimeout(() => {
            celebration.active = true;
            list.active = false;
            s.celebrating = true;
            ui.announcement = 'All tasks complete. You\'re all set.';
        }, CELEBRATE_AFTER);
    }

    function ring() {
        cancelAnimationFrame(frame);

        let previous = performance.now(),
            target = s.count / tasks.length;

        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            ui.shown = target;
            velocity = 0;
            return;
        }

        function step(now: number) {
            let dt = Math.min((now - previous) / 1000, 1 / 30);

            previous = now;
            velocity += (STIFFNESS * (target - ui.shown) - DAMPING * velocity) * dt;
            ui.shown += velocity * dt;

            if (Math.abs(target - ui.shown) < 0.0005 && Math.abs(velocity) < 0.001) {
                ui.shown = target;
                velocity = 0;
                return;
            }

            frame = requestAnimationFrame(step);
        }

        frame = requestAnimationFrame(step);
    }

    function row(task: Task, index: number) {
        let id = `${prefix}-${index}`,
            state = rows[index];

        return html`
            <li
                class='onboarding-checklist-task'
                ${defaults?.[ONBOARDING_CHECKLIST_TASK]}
                ${attributes[ONBOARDING_CHECKLIST_TASK]}
                ${{ class: () => `${state.done ? '--done' : ''} ${state.active ? '--open' : ''}` }}
            >
                <div class='onboarding-checklist-row'>
                    <label class='onboarding-checklist-toggle'>
                        ${checkbox({
                            class: 'onboarding-checklist-checkbox',
                            [factory.input]: {
                                'aria-label': task.title,
                                checked: () => state.done,
                                onchange: (e: Event) => toggle(index, (e.target as HTMLInputElement).checked)
                            }
                        })}
                    </label>

                    <button
                        aria-controls='${id}'
                        class='onboarding-checklist-summary'
                        type='button'
                        ${{
                            'aria-expanded': () => String(state.active),
                            onclick: () => {
                                state.active = !state.active;
                            }
                        }}
                    >
                        <span class='onboarding-checklist-title'>
                            ${task.title}
                            <span class='onboarding-checklist-strike' aria-hidden='true'></span>
                        </span>
                        <svg aria-hidden='true' class='onboarding-checklist-chevron' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'><path d='m4 6 4 4 4-4' /></svg>
                    </button>
                </div>

                ${accordion({ class: 'onboarding-checklist-details', id, state }, html`
                    <div class='onboarding-checklist-body'>
                        <p class='onboarding-checklist-description'>${task.description}</p>
                        <button
                            class='button onboarding-checklist-action'
                            type='button'
                            ${{
                                'aria-disabled': () => String(state.done),
                                onclick: () => {
                                    if (!state.done) {
                                        toggle(index, true);
                                    }
                                }
                            }}
                        >
                            <span class='onboarding-checklist-action-label' ${{ 'aria-hidden': () => String(state.done) }}>${task.action}</span>
                            <span class='onboarding-checklist-action-label onboarding-checklist-action-label--done' ${{ 'aria-hidden': () => String(!state.done) }}>
                                ${check()}
                                <span>Done</span>
                            </span>
                        </button>
                    </div>
                `)}
            </li>
        `;
    }

    function toggle(index: number, value: boolean) {
        rows[index].done = value;
        s.count = rows.filter((row) => row.done).length;
        ui.announcement = `${tasks[index].title} ${value ? 'done' : 'not done'}. ${s.count} of ${tasks.length} complete.`;
        ring();
        celebrate();
    }

    return html`
        <section
            aria-label='Get started'
            class='onboarding-checklist'
            ${defaults}
            ${attributes}
            ${{
                class: () => s.celebrating && '--celebrating',
                onconnect: () => untrack(celebrate),
                ondisconnect: () => {
                    cancelAnimationFrame(frame);
                    clearTimeout(timer);
                }
            }}
        >
            <header class='onboarding-checklist-header'>
                <div class='onboarding-checklist-heading'>
                    <h2 class='onboarding-checklist-heading-title'>Get started</h2>
                    <p class='onboarding-checklist-heading-count'>${() => `${s.count} of ${tasks.length} complete`}</p>
                </div>
                <div
                    aria-label='Setup progress'
                    aria-valuemax='100'
                    aria-valuemin='0'
                    class='onboarding-checklist-ring'
                    role='progressbar'
                    ${{
                        'aria-valuenow': () => Math.round(s.count / tasks.length * 100),
                        style: () => `--progress: ${ui.shown};`
                    }}
                >
                    <svg aria-hidden='true' viewBox='0 0 48 48'>
                        <circle class='onboarding-checklist-ring-track' cx='24' cy='24' fill='none' r='20' stroke-width='4' />
                        <circle class='onboarding-checklist-ring-fill' cx='24' cy='24' fill='none' pathLength='1' r='20' stroke-linecap='round' stroke-width='4' />
                    </svg>
                    <span class='onboarding-checklist-ring-value'>
                        ${() => Math.round(ui.shown * 100)}<span>%</span>
                    </span>
                </div>
            </header>

            ${accordion({ class: 'onboarding-checklist-collapse', state: list }, html`
                <ul class='onboarding-checklist-list'>
                    ${tasks.map(row)}
                </ul>
            `)}

            ${accordion({ class: 'onboarding-checklist-collapse', state: celebration }, html`
                <div class='onboarding-checklist-celebration'>
                    <h3 class='onboarding-checklist-celebration-title'>You're all set</h3>
                    <p class='onboarding-checklist-celebration-note'>
                        Your workspace is ready. You can find these steps again any time in Settings.
                    </p>
                    <div class='onboarding-checklist-celebration-actions'>
                        <button class='button onboarding-checklist-action' type='button' onclick='${() => ondismiss?.()}'>
                            Dismiss
                        </button>
                    </div>
                </div>
            `)}

            <p class='onboarding-checklist-live' aria-live='polite'>${() => ui.announcement}</p>
        </section>
    `;
}


export default Object.assign(template, { task: ONBOARDING_CHECKLIST_TASK } as const);
export type { State, Task };
