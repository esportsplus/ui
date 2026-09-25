import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { chevron, guide, progress, working, type Progress } from '~/components/log';
import './scss/index.scss';


type Chip = {
    icon?: Renderable<unknown>;
    label: string;
};

type Context = {
    collapse: boolean | 'all';
    revealed: () => number;
    total: number;
};

type Step = {
    chips?: Chip[];
    label: string;
};

type Task = {
    icon?: Renderable<unknown>;
    runningTitle?: string;
    steps: Step[];
    title: string;
};


function chip({ icon, label }: Chip) {
    return html`
        <span class='task-list-chip'>
            ${icon && html`<span class='task-list-chip-icon' aria-hidden='true'>${icon}</span>`}
            <span class='task-list-chip-label'>${label}</span>
        </span>
    `;
}

function step(context: Context, { chips, label }: Step, unit: number) {
    return html`
        <li class='log-row log-unit ${() => context.revealed() > unit && '--active'}' ${{ inert: () => context.revealed() <= unit }}>
            ${guide()}
            <div class='log-unit-content'>
                <div class='task-list-step'><span class='${() => context.revealed() === unit + 1 && context.revealed() < context.total && 'log-shimmer'}'>${label}</span>${chips?.map((value) => chip(value))}</div>
            </div>
        </li>
    `;
}

function task(context: Context, { icon, runningTitle, steps, title }: Task, head: number) {
    let end = head + 1 + steps.length,
        state = reactive({ open: null as boolean | null });

    let done = () => context.revealed() >= end,
        open = () => state.open ?? !(context.collapse === 'all' ? context.revealed() >= context.total : context.collapse && done());

    return html`
        <div
            class='task-list-task log-unit ${() => context.revealed() > head && '--active'} ${() => done() && '--done'}'
            ${{ inert: () => context.revealed() <= head }}
        >
            <div class='log-unit-content'>
                <button
                    class='task-list-header'
                    aria-expanded='${() => String(open())}'
                    type='button'
                    onclick='${() => state.open = !open()}'
                >
                    ${icon && html`<span class='task-list-icon' aria-hidden='true'>${icon}</span>`}
                    <span class='task-list-title'>
                        ${runningTitle && runningTitle !== title
                            ? html`
                                <span class='task-list-title-text task-list-title-text--running ${() => !done() && 'log-shimmer'}'>${runningTitle}</span>
                                <span class='task-list-title-text task-list-title-text--final'>${title}</span>
                            `
                            : html`<span class='task-list-title-text ${() => !done() && 'log-shimmer'}'>${title}</span>`}
                    </span>
                    ${chevron()}
                </button>

                <div class='task-list-steps ${() => open() && '--active'}' ${{ inert: () => !open() }}>
                    <ul class='task-list-steps-content' aria-live='polite'>
                        ${steps.map((value, i) => step(context, value, head + 1 + i))}
                    </ul>
                </div>
            </div>
        </div>
    `;
}


const taskList = ({
    collapseOnComplete = false,
    onComplete,
    startDelay = 320,
    state,
    stepInterval = 850,
    tasks,
    working: label = 'Working',
    ...attributes
}: Attributes & {
    collapseOnComplete?: boolean | 'all';
    onComplete?: VoidFunction;
    startDelay?: number;
    state?: Progress;
    stepInterval?: number;
    tasks: Task[];
    working?: false | string;
}) => {
    let heads: number[] = [],
        units = 0;

    for (let i = 0, n = tasks.length; i < n; i++) {
        heads.push(units);
        units += 1 + tasks[i].steps.length;
    }

    let { revealed, start, total } = progress({
            delay: (index) => index === 0 ? startDelay : stepInterval,
            onComplete,
            state,
            units
        }),
        context: Context = { collapse: collapseOnComplete, revealed, total };

    return html`
        <div class='log task-list' ${attributes} ${{ onconnect: start }}>
            ${tasks.map((value, i) => task(context, value, heads[i]))}
            ${label !== false && working(label, () => revealed() > 0 && revealed() < total)}
        </div>
    `;
};


export default taskList;
export type { Chip, Step, Task };
