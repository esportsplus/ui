import icon from '~/components/icon';
import githubSvg from '~/storage/svg/github.svg';
import { html, uri } from '../../app';
import { modal } from '../search';
import type { Request } from '../../app';
import './scss/index.scss';
import { version } from '../../../../package.json';

const release = version.split('.').slice(0, 2).join('.');


let tabs: { label: string; name: 'components' | 'css-utilities' | 'docs' | 'tokens' }[] = [
        { label: 'Docs', name: 'docs' },
        { label: 'Components', name: 'components' },
        { label: 'Utilities', name: 'css-utilities' },
        { label: 'Tokens', name: 'tokens' }
    ];


export default (request: Request) => html`
    <header class='docs-header --glass'>
        <div class='docs-header-inner'>
            <a class='docs-header-brand' href='${uri('docs')}' aria-label='Esportsplus UI home'>
                esportsplus<span class='docs-header-brand-ui'> / ui</span>
            </a>

            <span
                class='docs-header-version button button--flat'
                style='border: 1px solid var(--border-color);--font-size: var(--font-size-100);--font-weight: var(--font-weight-300);'
                title='v${version}'
            >
                v${release}
            </span>

            <nav class='docs-header-nav'>
                ${tabs.map((tab) => html`
                    <a
                        class='docs-header-link ${() => request.data.route?.name?.startsWith(tab.name) ? '--active' : ''}'
                        href='${uri(tab.name)}'
                    >${tab.label}</a>
                `)}
            </nav>

            <div class='docs-header-actions --flex-start'>
                <a
                    aria-label='GitHub'
                    class='docs-header-icon button --background-grey'
                    href='https://github.com/esportsplus/ui'
                    rel='noreferrer'
                    style='--padding-horizontal: var(--size-200);--padding-vertical: var(--size-200);'
                    target='_blank'
                >
                    ${icon({ class: '', 'aria-hidden': 'true', style: '--size: var(--size-400);' }, githubSvg)}
                </a>
            </div>
        </div>
    </header>

    ${modal()}
`;
