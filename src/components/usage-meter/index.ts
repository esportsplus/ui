import { computed, dispose, onCleanup, read } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import number from '../number';
import './scss/index.scss';


type Usage = {
    completion: number;
    context: number;
    cost?: number;
    prompt: number;
};


// Reads 'usage' inside bindings so a reactive object keeps the meter live
export default component(
    function({ label = 'Context window', usage, ...attributes }: Attributes & { label?: string; usage: Usage }) {
        let costed = computed(() => usage.cost !== undefined),
            used = computed(() => usage.prompt + usage.completion),
            ratio = computed(() => Math.min(1, read(used) / usage.context));

        onCleanup(() => {
            dispose(costed);
            dispose(ratio);
            dispose(used);
        });

        return html`
            <div
                class='usage-meter ${() => read(ratio) > 0.9 ? 'usage-meter--critical' : read(ratio) > 0.75 && 'usage-meter--warning'}'
                ${attributes}
            >
                <div class='usage-meter-header'>
                    <span class='usage-meter-label'>${label}</span>
                    <span class='usage-meter-count'>
                        ${() => `${number.abbreviate(read(used))} / ${number.abbreviate(usage.context)}`}
                        <span class='usage-meter-percent'>${() => ` · ${Math.round(read(ratio) * 100)}%`}</span>
                    </span>
                </div>

                <div
                    aria-label='${label}'
                    aria-valuemin='0'
                    class='usage-meter-track'
                    role='meter'
                    ${{
                        'aria-valuemax': () => usage.context,
                        'aria-valuenow': () => read(used),
                        'aria-valuetext': () => `${number.abbreviate(read(used))} of ${number.abbreviate(usage.context)} tokens, ${Math.round(read(ratio) * 100)}%`
                    }}
                >
                    <span class='usage-meter-fill' style='${() => `translate: ${(read(ratio) - 1) * 100}% 0`}'></span>
                </div>

                <div class='usage-meter-footer'>
                    <span class='usage-meter-breakdown'>
                        ${() => `prompt ${number.abbreviate(usage.prompt)} · completion ${number.abbreviate(usage.completion)}`}
                    </span>
                    ${() => read(costed) && html`
                        <span class='usage-meter-cost'>${() => `$${usage.cost!.toFixed(4)}`}</span>
                    `}
                </div>
            </div>
        `;
    }
);


export type { Usage };
