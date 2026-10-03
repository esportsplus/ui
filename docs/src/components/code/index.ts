import { html, reactive } from '~/app';
import { icon } from '@esportsplus/ui';
import copyIcon from '@esportsplus/ui/svg/copy.svg';
import checkIcon from '@esportsplus/ui/svg/check.svg';
import { tokenize } from './tokens';
import '~/docs-components/code/scss/index.scss';


const code = (source: string) => {
    let state = reactive({ copied: false, error: false }),
        request = 0,
        timer: ReturnType<typeof setTimeout> | undefined;

    const copy = async () => {
        const current = ++request;

        try {
            await navigator.clipboard.writeText(source);

            if (current !== request) {
                return;
            }

            clearTimeout(timer);
            state.copied = true;
            state.error = false;
            timer = setTimeout(() => {
                state.copied = false;
                timer = undefined;
            }, 3000);
        }
        catch {
            if (current !== request) {
                return;
            }

            clearTimeout(timer);
            state.copied = false;
            state.error = true;
        }
    };

    return html`
        <div class='code' ${{ ondisconnect: () => { request++; clearTimeout(timer); } }}>
            <button class='code-copy' type='button' aria-label='${() => state.error ? 'Copy unavailable. Select and copy the code.' : state.copied ? 'Code copied' : 'Copy code'}' title='${() => state.error ? 'Copy unavailable. Select and copy the code.' : state.copied ? 'Copied' : 'Copy code'}' ${{ onclick: copy }}>
                ${() => icon({ 'aria-hidden': 'true', class: state.copied ? 'code-copy-check' : '' }, state.copied ? checkIcon : copyIcon)}
            </button>
            <pre class='code-source --scrollbar' tabindex='0' aria-label='TypeScript code'><span class='code-lines' aria-hidden='true'>${source.split('\n').map((_, index) => index + 1).join('\n')}</span><code>${tokenize(source).map((token) =>
                token.kind ? html`<span class='code-token code-token--${token.kind}'>${token.text}</span>` : token.text
            )}</code></pre>
        </div>
    `;
};


export { code };
