import { clipboard } from '@esportsplus/ui';


export default {
    name: 'clipboard',
    variants: [
        {
            render: () => clipboard.copy(
                { class: 'button button--tertiary', style: '--width: auto;', value: 'Copied from the viewer!' },
                (state) => state.copied ? 'copied!' : state.failed ? 'failed' : 'copy'
            ),
            title: 'copy'
        }
    ]
};
