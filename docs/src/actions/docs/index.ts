import icon from '@esportsplus/ui/components/icon';
import infoSvg from '@esportsplus/ui/svg/info.svg';
import { html, reactive, uri } from 'docs/app';
import { pageHead } from 'docs/components/page/head';
import type { Router } from 'docs/app';
import type { Page } from 'docs/types';

import 'docs/actions/docs/scss/index.scss';


const SOURCE_TOKENS = /('[^']*'|@use|\bimport\b|\bfrom\b)/g;

const SOURCE_KEYWORD = /^(?:@use|import|from)$/;

const managers = ['pnpm', 'npm', 'yarn', 'bun'] as const;
const commands = { pnpm: 'pnpm add @esportsplus/ui', npm: 'npm install @esportsplus/ui', yarn: 'yarn add @esportsplus/ui', bun: 'bun add @esportsplus/ui' };
const example = "import { html } from '@esportsplus/template';\n\nhtml`<button class='button'>\n  Save changes\n</button>`;";
const styles = "@use '@esportsplus/ui/button.scss';\n@use '@esportsplus/ui/themes/dark/button.scss';";

// Source goes in through slots, which keep its whitespace; the template compiler collapses static HTML text.
const sourceCode = (source: string) => html`<code class='setup-code-text'>${source.split(SOURCE_TOKENS).map((fragment) =>
    fragment.startsWith("'") || SOURCE_KEYWORD.test(fragment)
        ? html`<span class='${fragment.startsWith("'") ? 'setup-token setup-token--string' : 'setup-token setup-token--keyword'}'>${fragment}</span>`
        : fragment
)}</code>`;

const render = () => {
    const state = reactive({ manager: 'pnpm' as typeof managers[number], copied: '', saved: false });
    const copy = async (value: string, key: string) => {
        try {
            await navigator.clipboard.writeText(value);
            state.copied = key;
        } catch {
            state.copied = 'error';
        }
    };

    return html`
        <div class='page setup'>
            ${pageHead({
                breadcrumb: [
                    { href: uri('docs'), label: 'Documentation' },
                    { href: uri('docs'), label: 'Getting started' }
                ],
                description: 'Add esportsplus/ui to your project and build your first component.',
                title: 'Installation'
            })}
            <div class='setup-notice'>${icon({ class: 'setup-notice-icon', 'aria-hidden': 'true' }, infoSvg)}<p>These examples assume your project already compiles templates and SCSS, with the library’s root styles and theme tokens configured.</p></div>
            <section class='setup-step' id='setup-package'>
                <span class='setup-step-number'>01</span><h2 class='setup-step-title'>Install the package</h2><p class='setup-step-description'>Use your preferred package manager to add the library to your project.</p>
                <div class='setup-code'>
                    <div class='setup-code-bar'><div class='setup-packages' role='group' aria-label='Package manager'>${managers.map((manager) => html`<button class='setup-package' type='button' aria-pressed='${() => state.manager === manager ? 'true' : 'false'}' ${{ onclick: () => { state.manager = manager; state.copied = ''; } }}>${manager}</button>`)}</div><button class='setup-code-copy' type='button' aria-label='Copy install command' ${{ onclick: () => copy(commands[state.manager], 'install') }}>${() => state.copied === 'install' ? 'Copied' : 'Copy'}</button></div>
                    <pre class='setup-code-source'><code class='setup-code-text'><span class='setup-prompt' aria-hidden='true'>$ </span>${() => commands[state.manager]}</code></pre>
                </div>
            </section>
            <section class='setup-step' id='setup-styles'>
                <span class='setup-step-number'>02</span><h2 class='setup-step-title'>Import the styles</h2><p class='setup-step-description'>Start with the component styles and a theme. You can customize the colors and sizing with <a class='setup-step-link' href='/tokens'>design tokens</a>.</p>
                <div class='setup-code'><div class='setup-code-bar'><span>app.scss</span><button class='setup-code-copy' type='button' aria-label='Copy styles' ${{ onclick: () => copy(styles, 'styles') }}>${() => state.copied === 'styles' ? 'Copied' : 'Copy'}</button></div><pre class='setup-code-source'>${sourceCode(styles)}</pre></div>
            </section>
            <section class='setup-step' id='setup-component'>
                <span class='setup-step-number'>03</span><h2 class='setup-step-title'>Use a component</h2><p class='setup-step-description'>Add the button classes to your template. Explore the <a class='setup-step-link' href='/components/button'>button reference</a> for colors, modifiers, and hold-to-confirm behavior.</p>
                <div class='setup-code'><div class='setup-code-bar'><span>app.ts</span><button class='setup-code-copy' type='button' aria-label='Copy component example' ${{ onclick: () => copy(example, 'example') }}>${() => state.copied === 'example' ? 'Copied' : 'Copy'}</button></div><pre class='setup-code-source'>${sourceCode(example)}</pre></div>
            </section>
            <div class='setup-example' id='setup-preview'><div class='setup-example-bar'><span>Button preview</span><a class='setup-example-link' href='/components/button'>View all variants</a></div><div class='setup-live'><button class='button setup-live-button' type='button' ${{ onclick: () => { state.saved = !state.saved; } }}>${() => state.saved ? 'Changes saved' : 'Save changes'}</button><span class='setup-live-feedback' aria-live='polite'>${() => state.saved ? 'Click again to reset the example.' : 'Try the button.'}</span></div></div>
            <p class='setup-copy-status' role='status'>${() => state.copied === 'error' && 'Copy is unavailable. Select and copy the code above.'}</p>
            <div class='setup-next'><a class='setup-next-link' href='/components/button'><span class='setup-next-label'>Continue exploring</span><strong class='setup-next-title'>Button</strong><p class='setup-next-description'>Explore button variants and interactions.</p></a><a class='setup-next-link' href='/themes'><span class='setup-next-label'>Customize your project</span><strong class='setup-next-title'>Theming</strong><p class='setup-next-description'>Make the library fit your design.</p></a></div>
        </div>
    `;
};


const responder = (): Page => ({
    render,
    toc: [
        { id: 'setup-package', label: 'Install the package' },
        { id: 'setup-styles', label: 'Import the styles' },
        { id: 'setup-component', label: 'Use a component' },
        { id: 'setup-preview', label: 'Preview' }
    ]
});


export { responder };
export default (r: Router) => r
    .get({ name: 'docs', path: '/docs', responder })
    .get({ name: 'home', path: '/', responder });

