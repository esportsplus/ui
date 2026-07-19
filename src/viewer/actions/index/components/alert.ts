import { alert } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


let stage = 'position: relative; min-height: 96px; display: flex; align-items: flex-start;',
    trigger = 'button button--tertiary';


const entry: Entry = {
    name: 'alert',
    variants: [
        {
            render: () => {
                let instance = alert({
                    style: 'background: var(--color-card-500, var(--color-grey-300)); border: 1px solid var(--color-border-400);'
                });

                return html`
                    <div style='${stage}'>${instance.content}</div>

                    <div style='display: flex; flex-wrap: wrap; gap: var(--size-400);'>
                        <div class='${trigger}' style='--width: auto;' onclick='${() => instance.success('Saved successfully.')}'>success</div>
                        <div class='${trigger}' style='--width: auto;' onclick='${() => instance.error('Something went wrong.')}'>error</div>
                        <div class='${trigger}' style='--width: auto;' onclick='${() => instance.info('Heads up — just so you know.')}'>info</div>
                    </div>
                `;
            },
            title: 'triggers'
        }
    ]
};


export default entry;
