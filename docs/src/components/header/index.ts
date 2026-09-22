import icon from '~/components/icon';
import githubSvg from '~/storage/svg/github.svg';
import { html, uri } from '../../app';
import { modal, search } from '../search';
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
    <header class='header --glass'>
        <div class='header-inner'>
            <a class='header-brand' href='${uri('docs')}' aria-label='Esportsplus UI home'>
                esportsplus<span class='header-brand-ui'> / ui</span>
            </a>

            <span
                class='header-version button button--flat --border --font-size-100 --font-weight-300'
                title='v${version}'
            >
                v${release}
            </span>

            <nav class='header-nav'>
                ${tabs.map((tab) => html`
                    <a
                        class='header-link ${() => request.data.route?.name?.startsWith(tab.name) ? '--active' : ''}'
                        href='${uri(tab.name)}'
                    >${tab.label}</a>
                `)}
            </nav>

            <div class='header-actions --flex-start'>
                <a
                    aria-label='GitHub'
                    class='header-icon button --background-grey --color-text --padding-200'
                    href='https://github.com/esportsplus/ui'
                    rel='noreferrer'
                    target='_blank'
                >
                    ${icon({ class: '', 'aria-hidden': 'true', style: '--size: var(--size-400);' }, githubSvg)}
                </a>
            </div>
        </div>
    </header>

    ${() => search.open && modal()}
`;
