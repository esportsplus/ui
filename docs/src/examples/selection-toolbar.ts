import { html } from '@esportsplus/template';
import { selectionToolbar } from '@esportsplus/ui';
import './selection-toolbar.scss';


export default {
    name: 'selection-toolbar',
    variants: [
        {
            // Fixed height, so typing into the note scrolls inside the card instead of growing the demo.
            render: () => html`
                <div class='selection-toolbar-demo'>
                    ${selectionToolbar(
                        { href: 'https://lab.xevrion.dev', label: 'Note' },
                        html`
                            <p>Good interfaces are made of details nobody notices. The press that gives a little under your finger, the menu that grows out of the button you clicked, the toolbar that appears right where your attention already is.</p>
                            <p>Select any part of this note to format it. Try a word on the first line too: with no room above, the toolbar flips below the text.</p>
                        `
                    )}
                </div>
            `,
            title: 'note'
        },
        {
            render: () => html`
                <div class='selection-toolbar-demo selection-toolbar-demo--surface'>
                    ${selectionToolbar(
                        { class: 'selection-toolbar--white', label: 'Draft' },
                        html`
                            <p>Press <strong>Ctrl</strong> or <strong>Cmd</strong> with <em>B</em> or <em>I</em> on a selection, or use the arrow keys once focus is inside the toolbar. <mark>Escape</mark> dismisses it until the selection changes.</p>
                        `
                    )}
                </div>
            `,
            title: 'on a surface'
        }
    ]
};
