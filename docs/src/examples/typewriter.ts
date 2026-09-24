import { typewriter } from '@esportsplus/ui';


let lines = ['Build once.', 'Ship everywhere.', '@esportsplus/ui'];


export default {
    name: 'typewriter',
    variants: [
        {
            render: () => typewriter({}, lines),
            title: 'cycling text'
        },
        {
            render: () => typewriter({ class: 'typewriter--block typewriter--hard' }, lines),
            title: 'block caret, hard blink'
        },
        {
            render: () => typewriter({ class: 'typewriter--underscore' }, lines),
            title: 'underscore caret'
        },
        {
            render: () => typewriter({ class: 'typewriter--glow', style: '--caret-color: var(--color-blue-400);' }, lines),
            title: 'glow'
        }
    ]
};
