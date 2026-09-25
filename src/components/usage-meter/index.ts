import { component, html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type Usage = {
    completion: number;
    context: number;
    cost?: number;
    prompt: number;
};


function format(count: number) {
    return count < 1000 ? `${count}` : `${(count / 1000).toFixed(1)}k`;
}


// Reads 'usage' inside bindings so a reactive object keeps the meter live
export default component(
    function({ label = 'Context window', usage, ...attributes }: Attributes & { label?: string; usage: Usage }) {
        let ratio = () => Math.min(1, (usage.prompt + usage.completion) / usage.context);

        return html`
            <div
                class='usage-meter'
                data-level='${() => ratio() > 0.9 ? 'critical' : ratio() > 0.75 ? 'warning' : 'normal'}'
                style='${() => `--ratio: ${ratio()}`}'
                ${attributes}
            >
                <div class='usage-meter-header'>
                    <span class='usage-meter-label'>${label}</span>
                    <span class='usage-meter-count'>
                        ${() => `${format(usage.prompt + usage.completion)} / ${format(usage.context)}`}
                        <span class='usage-meter-percent'>${() => ` · ${Math.round(ratio() * 100)}%`}</span>
                    </span>
                </div>

                <div
                    aria-label='${label}'
                    aria-valuemax='${() => usage.context}'
                    aria-valuemin='0'
                    aria-valuenow='${() => usage.prompt + usage.completion}'
                    class='usage-meter-track'
                    role='meter'
                >
                    <span class='usage-meter-fill'></span>
                </div>

                <div class='usage-meter-footer'>
                    <span class='usage-meter-breakdown'>
                        ${() => `prompt ${format(usage.prompt)} · completion ${format(usage.completion)}`}
                    </span>
                    ${() => usage.cost !== undefined && html`
                        <span class='usage-meter-cost'>${`$${usage.cost.toFixed(4)}`}</span>
                    `}
                </div>
            </div>
        `;
    }
);


export type { Usage };
