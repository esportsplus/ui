import { theme } from '@esportsplus/ui/components';
import { mode } from 'docs/data/theme';
import type { Entry } from 'docs/types';


// Every picker drives the docs' own theme instance, so each one here switches these docs.
export default {
    name: 'theme',
    variants: [
        {
            render: () => theme.toggle({ mode }),
            title: 'toggle'
        },
        {
            render: () => theme.cards({ mode }),
            title: 'cards'
        },
        {
            render: () => theme.swatches({ mode }),
            title: 'swatches'
        }
    ]
} satisfies Entry;
