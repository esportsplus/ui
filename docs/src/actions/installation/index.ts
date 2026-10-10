import { highlight } from '@esportsplus/ui/components';
import { html, reactive, uri } from 'docs/app';
import { preview } from 'docs/components/preview';
import type { Renderable, Router } from 'docs/app';
import type { Page } from 'docs/types';
import header from 'docs/components/page/header';

import '@esportsplus/ui/components/link/scss/index.scss';
import '@esportsplus/ui/components/section/scss/index.scss';
import 'docs/actions/installation/scss/index.scss';


type Section = {
    description: Renderable<unknown>;
    id: string;
    preview: Renderable<unknown>;
    title: string;
};


const commands = {
    bun: 'bun add @esportsplus/ui',
    npm: 'npm install @esportsplus/ui',
    pnpm: 'pnpm add @esportsplus/ui',
    yarn: 'yarn add @esportsplus/ui'
};

const example = "import { html } from '@esportsplus/template';\n\nhtml`<button class='button'>\n  Save changes\n</button>`;";

const managers = ['pnpm', 'npm', 'yarn', 'bun'] as const;

const styles = "@use '@esportsplus/ui/button.scss';\n@use '@esportsplus/ui/theme.scss';";


const responder = (): Page => {
    let state = reactive({ manager: 'pnpm' as typeof managers[number] }),
        sections: Section[] = [
            {
                description: 'Use your preferred package manager to add the library to your project.',
                id: 'installation-package',
                preview: preview({
                    aside: html`
                        <div class='installation-packages' role='group' aria-label='Package manager'>
                            ${highlight({ class: 'installation-packages-highlight' })}
                            ${managers.map((manager) => html`
                                <button
                                    class='link installation-package ${() => state.manager === manager && '--active'}'
                                    type='button'
                                    ${{
                                        'aria-pressed': () => String(state.manager === manager),
                                        onclick: () => {
                                            state.manager = manager;
                                        }
                                    }}
                                >
                                    ${manager}
                                </button>
                            `)}
                        </div>
                    `,
                    class: 'installation-code',
                    code: {
                        class: 'installation-viewer--terminal',
                        lineNumbers: false,
                        value: () => commands[state.manager]
                    },
                    title: 'Terminal'
                }),
                title: 'Install the package'
            },
            {
                description: html`Start with the component styles and a theme. You can customize the colors and sizing with <a class='installation-step-link' href='/tokens'>design tokens</a>.`,
                id: 'installation-styles',
                preview: preview({
                    class: 'installation-code',
                    code: { language: 'scss', value: styles },
                    title: 'app.scss'
                }),
                title: 'Import the styles'
            },
            {
                description: html`Add the button classes to your template. Explore the <a class='installation-step-link' href='/components/button'>button reference</a> for colors, modifiers, and hold-to-confirm behavior.`,
                id: 'installation-component',
                preview: preview({
                    class: 'installation-code',
                    code: { language: 'typescript', value: example },
                    title: 'app.ts'
                }),
                title: 'Use a component'
            }
        ];

    return {
        render: () => html`
            <div class='page installation'>
                ${header({
                    breadcrumb: [{ href: uri('installation'), label: 'Getting Started' }, { href: uri('installation'), label: 'Installation' }],
                    description: 'Add esportsplus/ui to your project and build your first component.',
                    title: 'Installation'
                })}

                ${sections.map((section, index) => html`
                    <section class='section installation-step' id='${section.id}'>
                        <span class='installation-step-number'>${index + 1}</span>
                        <div class='section-header'>
                            <h2 class='section-title'>${section.title}</h2>
                            <p class='section-subtitle'>${section.description}</p>
                        </div>

                        ${section.preview}
                    </section>
                `)}
            </div>
        `,
        toc: sections.map((section) => ({ id: section.id, label: section.title }))
    };
};


export { responder };
export default (r: Router) => r
    .get({ name: 'installation', path: '/installation', responder })
    .get({ name: 'home', path: '/', responder });
