import { switch as switchComponent } from '@esportsplus/ui';
import { switchVariations } from './form-prototypes';


let style = '--accent: var(--color-white-400); --background-active: var(--color-primary-400); --background-default: var(--color-border-500);';


export default {
    name: 'switch',
    variants: [
        ...switchVariations(),
        {
            render: () => switchComponent({ style }),
            title: 'default'
        },
        {
            render: () => switchComponent({ checked: true, style }),
            title: 'on'
        }
    ]
};
