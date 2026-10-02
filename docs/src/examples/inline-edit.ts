import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { inlineEdit } from '@esportsplus/ui';
import './inline-edit.scss';


const SAVED_FOR = 1600;


export default {
    name: 'inline-edit',
    variants: [
        {
            render: () => {
                let status = reactive({ saved: false }),
                    timer: ReturnType<typeof setTimeout> | undefined;

                function saved() {
                    status.saved = true;
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        status.saved = false;
                    }, SAVED_FOR);
                }

                return html`
                    <section aria-label='Profile' class='inline-edit-demo'>
                        <div class='inline-edit-demo-header'>
                            <span aria-hidden='true' class='inline-edit-demo-avatar'>AM</span>
                            <span aria-hidden='true' class='inline-edit-demo-saved ${() => status.saved && '--active'}'>
                                <svg fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 16 16'>
                                    <path d='m3.5 8.5 3 3 6-7' />
                                </svg>
                                Saved
                            </span>
                            <span aria-live='polite' class='inline-edit-demo-live'>${() => status.saved ? 'Saved' : ''}</span>
                        </div>
                        ${inlineEdit({
                            class: 'inline-edit-demo-name',
                            label: 'Name',
                            onsave: saved,
                            placeholder: 'Add your name',
                            value: 'Ava Moreno'
                        })}
                        <p class='inline-edit-demo-handle'>@ava · Lisbon</p>
                        ${inlineEdit({
                            class: 'inline-edit-demo-bio',
                            label: 'Bio',
                            multiline: true,
                            onsave: saved,
                            placeholder: 'Add a short bio',
                            value: 'Design engineer. Builds the small interactions nobody notices until they are missing.'
                        })}
                    </section>
                `;
            },
            title: 'profile - without rich editor'
        },
        {
            render: () => {
                let state = reactive({ editing: false, saved: false, value: '' });

                return html`
                    <div class='inline-edit-demo inline-edit-demo--plain'>
                        ${inlineEdit({ label: 'Project name', placeholder: 'Untitled project', state })}
                        <span class='inline-edit-demo-handle'>
                            ${() => state.editing ? 'Editing… Enter saves, Escape cancels' : `Value: ${state.value || '(empty)'}`}
                        </span>
                    </div>
                `;
            },
            title: 'empty + observed state'
        },
        {
            render: () => html`
                <article aria-label='Release notes' class='inline-edit-demo inline-edit-demo--page'>
                    ${inlineEdit({
                        class: 'inline-edit--seamless inline-edit-demo-title',
                        label: 'Title',
                        placeholder: 'Untitled',
                        value: 'Release notes: September'
                    })}
                    <p class='inline-edit-demo-handle'>Draft · edited just now</p>
                    ${inlineEdit.rich({
                        class: 'inline-edit--seamless inline-edit-demo-bio',
                        features: ['bold', 'italic', 'highlight', 'link', 'heading', 'bullet', 'copy'],
                        label: 'Body',
                        multiline: true,
                        placeholder: 'Start writing…',
                        value: [
                            'Search now matches across **every workspace** you belong to. Results rank by recency first, then by how often you open them.',
                            '## What changed',
                            '- Select any text to format it',
                            '- ==Escape== always takes you back to where you were'
                        ].join('\n\n')
                    })}
                </article>
            `,
            title: 'seamless'
        },
        {
            render: () => html`
                <div class='inline-edit-demo inline-edit-demo--wide'>
                    ${inlineEdit.rich({
                        class: 'inline-edit-demo-bio',
                        features: ['bold', 'italic', 'strike', 'code', 'highlight', 'link', 'heading', 'quote', 'codeblock', 'bullet', 'ordered', 'task', 'clear', 'copy'],
                        label: 'Note',
                        multiline: true,
                        placeholder: 'Write a note',
                        value: [
                            '# Launch notes',
                            'Good interfaces are made of details nobody notices: the press that gives a little, the menu that grows out of the button you clicked, the [toolbar](https://esportsplus.com) that appears right where your attention already is.',
                            '> Select text to format it. Rest on a button to see its shortcut.',
                            '- [x] Markdown in, markdown out',
                            '- [ ] Whitelist per field',
                            '```\ninlineEdit.rich({ features: [\'bold\', \'link\'] })\n```'
                        ].join('\n\n')
                    })}
                </div>
            `,
            title: 'every feature'
        },
        {
            render: () => {
                let state = reactive({ editing: false, saved: false, value: 'Ship the **new** docs' });

                return html`
                    <div class='inline-edit-demo inline-edit-demo--plain'>
                        ${inlineEdit.rich({ features: ['bold', 'italic'], label: 'Task', placeholder: 'Name this task', state })}
                        <span class='inline-edit-demo-handle'>${() => `Markdown: ${state.value || '(empty)'}`}</span>
                    </div>
                `;
            },
            title: 'one line, bold + italic only'
        }
    ]
};
