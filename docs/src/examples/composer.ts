import { composer, toast, tooltip } from '@esportsplus/ui';
import { html, type Renderable } from '@esportsplus/template';


let glyph = 'width: var(--size-400); height: var(--size-400); flex: 0 0 auto;',
    menu = 'padding: var(--size-200) var(--size-400); --color-default: var(--color-text-400); white-space: nowrap;',
    popup = '--background: var(--color-white-300); border: var(--border-width-400) solid var(--color-border-300);';


let branch = () => html`
        <svg style='${glyph}' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'>
            <path d='M6 3v12' /><circle cx='18' cy='6' r='3' /><circle cx='6' cy='18' r='3' /><path d='M18 9a9 9 0 0 1-9 9' />
        </svg>
    `,
    chevron = () => html`
        <svg style='${glyph}' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'>
            <path d='m6 9 6 6 6-6' />
        </svg>
    `,
    folder = () => html`
        <svg style='${glyph}' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'>
            <path d='M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z' />
        </svg>
    `,
    plus = () => html`
        <svg style='${glyph}' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'>
            <path d='M5 12h14' /><path d='M12 5v14' />
        </svg>
    `,
    worktree = () => html`
        <svg style='${glyph}' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'>
            <circle cx='12' cy='18' r='3' /><circle cx='6' cy='6' r='3' /><circle cx='18' cy='6' r='3' /><path d='M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9' /><path d='M12 12v3' />
        </svg>
    `;


let dropdown = (options: string[], content: Renderable<unknown>) => tooltip.menu(
    {
        class: 'composer-action',
        [tooltip.menu.option]: { style: menu },
        options: options.map((option) => ({
            content: option,
            onclick: () => toast.message(option)
        })),
        [tooltip.menu.tooltipContent]: { direction: 'nw', style: popup }
    },
    content
);

let submit = async (value: string) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    toast.success('Sent', { description: value });
};


export default {
    name: 'composer',
    variants: [
        {
            render: () => composer({
                actions: html`
                    ${dropdown(['Attach file', 'Add context'], plus())}
                    <div class='composer-action'>Interactive</div>
                    <div class='composer-separator'></div>
                    <div class='composer-action'>Auto</div>
                `,
                footer: html`
                    ${dropdown(['process', 'ui', 'docs'], html`${folder()} process ${chevron()}`)}
                    ${dropdown(['New worktree', 'Current checkout'], html`${worktree()} New worktree ${chevron()}`)}
                    ${dropdown(['main', 'develop'], html`${branch()} main ${chevron()}`)}
                    <div class='composer-action' style='margin-left: auto;'>${plus()} Add project</div>
                `,
                submit,
                [composer.textarea]: { placeholder: 'Ask anything, paste a URL, type / for commands or # for issues…' }
            }),
            title: 'default'
        },
        {
            render: () => composer({
                submit,
                [composer.textarea]: { placeholder: 'Send a message…' }
            }),
            title: 'minimal'
        }
    ]
};
