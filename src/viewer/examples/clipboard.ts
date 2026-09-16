import { clipboard } from '@esportsplus/ui';
import type { Entry } from '~/viewer/types';


const entry: Entry = {
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


export default entry;
