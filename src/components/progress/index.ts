import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import text from './text';
import './scss/index.scss';


type A = Attributes & {
    label?: string;
    // Shows the rounded percentage beside the label.
    percent?: boolean;
    state?: State;
    // A line under the bar describing the current stage, derived from the value.
    status?: (value: number) => string;
    value?: number;
};

type State = {
    value: number;
};


function clamp(value: number) {
    return Math.min(100, Math.max(0, value || 0));
}


function bar({ label, percent = true, state, status, value = 0, ...attributes }: A) {
    state ??= reactive({ value });

    let current = () => clamp(state.value),
        rounded = () => Math.round(current());

    return html`
        <div class='progress' ${attributes}>
            ${label && html`
                <div class='progress-header'>
                    <span class='progress-label'>${label}</span>
                    ${percent && html`<span class='progress-percent'>${() => `${rounded()}%`}</span>`}
                </div>
            `}

            <div
                aria-label='${label ?? 'Progress'}'
                aria-valuemax='100'
                aria-valuemin='0'
                class='progress-track'
                role='progressbar'
                ${{
                    'aria-valuenow': rounded,
                    'aria-valuetext': () => status ? status(current()) : `${rounded()}%`
                }}
            >
                <div class='progress-indicator' style='${() => `translate: ${current() - 100}% 0`}'></div>
            </div>

            ${status && html`<div class='progress-status'>${() => status(current())}</div>`}
        </div>
    `;
}


const progress: typeof bar & { text: typeof text } = Object.assign(bar, { text });


export default progress;
export type { State as ProgressState };
export type { ProgressTextState } from './text';
