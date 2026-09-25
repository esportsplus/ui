import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { shareButton } from '@esportsplus/ui';


export default {
    name: 'share-button',
    variants: [
        {
            render: () => shareButton({
                title: 'Share button, from ui lab',
                url: 'https://lab.xevrion.dev/lab/share-button'
            }),
            title: 'share'
        },
        {
            render: () => {
                let state = reactive({ copied: false, open: true });

                return html`
                    <div style='align-items: center; display: flex; gap: var(--size-400);'>
                        ${shareButton({
                            class: 'share-button--surface',
                            state,
                            text: 'Share post',
                            title: 'Notes on interruptible motion',
                            url: 'https://example.com/notes'
                        })}
                        <span style='color: var(--color-text-300); font-size: 14px;'>${() => state.open ? 'open' : 'closed'}</span>
                    </div>
                `;
            },
            title: 'surface, starts open'
        }
    ]
};
