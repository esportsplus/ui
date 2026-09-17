import { clipboard } from '@esportsplus/ui';


export default {
    name: 'clipboard',
    variants: [
        {
            render: () => clipboard.onclick(
                { class: 'button button--tertiary', style: '--width: auto;', value: 'Copied from the viewer!' },
                (state) => state.copied ? 'copied!' : 'copy'
            ),
            title: 'onclick'
        }
    ]
};
