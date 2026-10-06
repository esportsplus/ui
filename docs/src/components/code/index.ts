import { html } from 'docs/app';
import { copy } from '@esportsplus/ui/components';
import { tokenize } from './tokens';
import 'docs/components/code/scss/index.scss';


const code = (source: string, flush = false) => {
    return html`
        <div class='code ${flush ? 'code--flush' : ''}'>
            ${copy({
                class: 'code-copy',
                error: 'Copy unavailable. Select and copy the code.',
                label: 'Copy code',
                success: 'Code copied',
                value: source
            })}
            <pre class='code-source --scrollbar --scrollbar-hover' tabindex='0' aria-label='TypeScript code'><span class='code-lines' aria-hidden='true'>${source.split('\n').map((_, index) => index + 1).join('\n')}</span><code class='code-text'>${tokenize(source).map((token) =>
                token.kind ? html`<span class='code-token code-token--${token.kind}'>${token.text}</span>` : token.text
            )}</code></pre>
        </div>
    `;
};


export { code };
