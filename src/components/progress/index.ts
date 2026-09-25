import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
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


export default ({ label, percent = true, state, status, value = 0, ...attributes }: A) => {
    let s = state ?? reactive({ value });

    return html`
        <div class='progress' ${attributes}>
            ${label && html`
                <div class='progress-header'>
                    <span class='progress-label'>${label}</span>
                    ${percent && html`<span class='progress-percent'>${() => `${Math.round(clamp(s.value))}%`}</span>`}
                </div>
            `}

            <div
                aria-label='${label ?? 'Progress'}'
                aria-valuemax='100'
                aria-valuemin='0'
                class='progress-track'
                role='progressbar'
                ${{
                    'aria-valuenow': () => Math.round(clamp(s.value)),
                    'aria-valuetext': () => status ? status(clamp(s.value)) : `${Math.round(clamp(s.value))}%`
                }}
            >
                <div class='progress-indicator' style='${() => `translate: ${clamp(s.value) - 100}% 0`}'></div>
            </div>

            ${status && html`<div class='progress-status'>${() => status(clamp(s.value))}</div>`}
        </div>
    `;
};

export type { State as ProgressState };
