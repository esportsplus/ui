import { stackedDrawer } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


type Sheet = {
    description: string;
    next?: string;
    title: string;
};


let body = 'display: flex; flex: 1; flex-direction: column; padding: var(--size-500) var(--size-600) var(--size-600);',
    button = '--border-radius: 9999px; --width: 100%; height: 44px;',
    muted = 'color: var(--color-text-300);';


function demo(sheets: Sheet[]) {
    let state = reactive({ depth: 0 });

    return stackedDrawer(
        {
            sheets: sheets.map(({ description, next, title }, index) => ({
                'aria-label': title,
                content: html`
                    <div style='${body}'>
                        <h3>${title}</h3>
                        <div class='text' style='${muted} margin-top: var(--size-200);'>${description}</div>

                        <div style='display: flex; flex-direction: column; gap: var(--size-300); margin-top: auto;'>
                            ${next && index + 1 < sheets.length && html`
                                <button class='button --background-black --color-white' style='${button}' type='button' onclick='${() => state.depth = index + 2}'>
                                    ${next}
                                </button>
                            `}
                            <button class='button --background-white --border-border --color-text' style='${button} --border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color);' type='button' onclick='${() => state.depth = index}'>
                                Done
                            </button>
                        </div>
                    </div>
                `
            })),
            state,
            style: '--height: 560px; --width: 320px;'
        },
        html`
            <div style='${body} padding: var(--size-700);'>
                <div class='text' style='${muted}'>Drafts</div>
                <h2 style='margin-top: var(--size-200);'>Launch notes</h2>
                <div class='text' style='${muted} margin-top: var(--size-400);'>
                    Three fixes, one new component, and a faster index. Ship Thursday after review.
                </div>

                <button class='button --background-black --color-white' style='${button} margin-top: auto;' type='button' onclick='${() => state.depth = 1}'>
                    Share
                </button>
            </div>
        `
    );
}


export default {
    name: 'stacked-drawer',
    variants: [
        {
            render: () => demo([
                {
                    description: 'Anyone with the link can view. Invite people to let them edit.',
                    next: 'Invite people',
                    title: 'Share draft'
                },
                {
                    description: "They'll get an email and can edit right away.",
                    title: 'Invite people'
                }
            ]),
            title: 'share flow'
        },
        {
            render: () => demo([
                {
                    description: 'Pick who can see this draft.',
                    next: 'Advanced',
                    title: 'Visibility'
                },
                {
                    description: 'Control link expiry and download access.',
                    next: 'Expiry',
                    title: 'Advanced'
                },
                {
                    description: 'Links stop working after the date you choose. Drag down or press Esc to go back.',
                    title: 'Expiry'
                }
            ]),
            title: 'three levels'
        }
    ]
};
