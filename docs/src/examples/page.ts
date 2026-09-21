import { html } from '@esportsplus/template';


export default {
    name: 'page',
    variants: [
        {
            render: () => html`
                <div style='display: flex; flex-direction: column; gap: var(--size-200); padding: var(--size-400) 0;'>
                    <div class='page-suptitle' style='text-transform: uppercase;'>Suptitle</div>
                    <div class='page-title' style='--font-size: var(--font-size-700); font-size: var(--font-size-700); font-weight: var(--font-weight-600);'>Page title</div>
                    <div class='page-subtitle'>A supporting subtitle describing the section below.</div>
                </div>
            `,
            title: 'typography'
        }
    ]
};
