import { html } from '@esportsplus/template';
import { typewriter } from '@esportsplus/ui';
import './typewriter.scss';


let lines = ['Build once.', 'Ship everywhere.', '@esportsplus/ui'],
    prefix = 'Build interfaces that feel',
    words = ['right', 'fast', 'alive', 'effortless'];


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
            render: () => html`<p class='typewriter-retype-demo'>${typewriter.retype({ prefix, words })}</p>`,
            title: 'select and retype'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriter.retype({ class: 'typewriter-retype--block typewriter-retype--hard', prefix, words })}
                </p>
            `,
            title: 'retype, block caret, hard blink'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriter.retype({ class: 'typewriter-retype--underscore', prefix, words })}
                </p>
            `,
            title: 'retype, underscore caret'
        },
        {
            render: () => html`
                <p class='typewriter-retype-demo'>
                    ${typewriter.retype({
                        prefix: 'Deploy to',
                        style: '--caret-color: var(--color-blue-400); --selection-color: oklch(from var(--color-blue-400) l c h / 0.2);',
                        words: ['production', 'staging', 'the edge']
                    })}
                </p>
            `,
            title: 'retype, tinted caret and selection'
        }
    ]
};
