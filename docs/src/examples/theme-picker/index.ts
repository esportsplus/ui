import { themePicker } from '@esportsplus/ui/components';
import { mode } from 'docs/data/theme';
import type { Entry } from 'docs/types';


// Every picker drives the docs' own theme instance, so each one here switches these docs.
export default {
    name: 'theme-picker',
    variants: [
        {
            render: () => themePicker.toggle({ mode }),
            title: 'toggle'
        },
        {
            render: () => themePicker.cards({ mode }),
            title: 'cards'
        },
        {
            render: () => themePicker.swatches({ mode }),
            title: 'swatches'
        }
    ]
} satisfies Entry;
