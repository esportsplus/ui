import icon from '~/components/icon';
import infoSvg from '~/storage/svg/info.svg';
import { html, reactive } from '../../app';
import { pageNavigation } from '../page-navigation';

import './scss/index.scss';

const managers = ['pnpm', 'npm', 'yarn', 'bun'] as const;
const commands = { pnpm: 'pnpm add @esportsplus/ui', npm: 'npm install @esportsplus/ui', yarn: 'yarn add @esportsplus/ui', bun: 'bun add @esportsplus/ui' };
const example = "import { html } from '@esportsplus/template';\n\nhtml`<button class='button button--primary'>\n  Save changes\n</button>`;";
const styles = "@use '@esportsplus/ui/button.scss';\n@use '@esportsplus/ui/themes/dark/button.scss';";

// Preserve source whitespace: the template compiler collapses static HTML text.
const sourceCode = (source: string) => html`<code ${{ onconnect: (element: HTMLElement) => {
    const fragments = source.split(/('[^']*'|@use|\bimport\b|\bfrom\b)/g);
    element.replaceChildren(...fragments.map((fragment) => {
        if (fragment.startsWith("'") || /^(?:@use|import|from)$/.test(fragment)) {
            const span = document.createElement('span');
            span.className = fragment.startsWith("'") ? 'code-string' : 'code-keyword';
            span.textContent = fragment;
            return span;
        }
        return document.createTextNode(fragment);
    }));
} }}></code>`;

export default () => {
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
        <div class='setup-guide'>
            <div class='setup-heading'>
                <div class='setup-breadcrumb'><a href='/docs'>Documentation</a><span aria-hidden='true'>/</span><span>Getting started</span></div>
                <div class='docs-title-row'><h1>Installation</h1>${pageNavigation()}</div>
                <p>Add esportsplus/ui to your project and build your first component.</p>
            </div>
            <div class='setup-notice'>${icon({ class: 'setup-notice-icon', 'aria-hidden': 'true', style: '--size: var(--size-400);' }, infoSvg)}<p>These examples assume your project already compiles templates and SCSS, with the library’s root styles and theme tokens configured.</p></div>
            <section class='setup-step' id='setup-package'>
                <div class='setup-explanation'><span class='setup-step-number'>01</span><h2>Install the package</h2><p>Use your preferred package manager to add the library to your project.</p></div>
                <div class='setup-code'>
                    <div class='setup-code-bar'><div class='package-options' role='group' aria-label='Package manager'>${managers.map((manager) => html`<button type='button' aria-pressed='${() => state.manager === manager ? 'true' : 'false'}' ${{ onclick: () => { state.manager = manager; state.copied = ''; } }}>${manager}</button>`)}</div><button class='copy-code' type='button' aria-label='Copy install command' ${{ onclick: () => copy(commands[state.manager], 'install') }}>${() => state.copied === 'install' ? 'Copied' : 'Copy'}</button></div>
                    <pre><code><span class='code-prompt' aria-hidden='true'>$ </span>${() => commands[state.manager]}</code></pre>
                </div>
            </section>
            <section class='setup-step' id='setup-styles'>
                <div class='setup-explanation'><span class='setup-step-number'>02</span><h2>Import the styles</h2><p>Start with the component styles and a theme. You can customize the colors and sizing with <a href='/tokens'>design tokens</a>.</p></div>
                <div class='setup-code'><div class='setup-code-bar'><span>app.scss</span><button class='copy-code' type='button' aria-label='Copy styles' ${{ onclick: () => copy(styles, 'styles') }}>${() => state.copied === 'styles' ? 'Copied' : 'Copy'}</button></div><pre>${sourceCode(styles)}</pre></div>
            </section>
            <section class='setup-step' id='setup-component'>
                <div class='setup-explanation'><span class='setup-step-number'>03</span><h2>Use a component</h2><p>Add the button classes to your template. Explore the <a href='/components/button'>button reference</a> for colors, modifiers, and hold-to-confirm behavior.</p></div>
                <div class='setup-code'><div class='setup-code-bar'><span>app.ts</span><button class='copy-code' type='button' aria-label='Copy component example' ${{ onclick: () => copy(example, 'example') }}>${() => state.copied === 'example' ? 'Copied' : 'Copy'}</button></div><pre>${sourceCode(example)}</pre></div>
            </section>
            <div class='setup-example' id='setup-preview'><div class='setup-example-bar'><span>Button preview</span><a href='/components/button'>View all variants</a></div><div class='preview-stage setup-live'><button class='button button--primary' type='button' style='--width: auto;' ${{ onclick: () => { state.saved = !state.saved; } }}>${() => state.saved ? 'Changes saved' : 'Save changes'}</button><span class='setup-live-feedback' aria-live='polite'>${() => state.saved ? 'Click again to reset the example.' : 'Try the button.'}</span></div></div>
            <p class='setup-copy-status' role='status'>${() => state.copied === 'error' ? 'Copy is unavailable. Select and copy the code above.' : ''}</p>
            <div class='setup-next'><a href='/components/button'><span>Continue exploring</span><strong>Button</strong><p>Explore button variants and interactions.</p></a><a href='/themes'><span>Customize your project</span><strong>Theming</strong><p>Make the library fit your design.</p></a></div>
        </div>
    `;
};

