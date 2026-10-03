import icon from '~/components/icon';
import glass from '~/css-utilities/glass';
import githubSvg from '@esportsplus/ui/svg/github.svg';
import sidebarSvg from '@esportsplus/ui/svg/sidebar.svg';
import { html, uri } from '../../app';
import { modal, searchTrigger } from '../search';
import { state as sidebar } from '../sidebar';
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
    <header class='header' ${glass()}>
        <div class='header-inner'>
            <button
                aria-controls='docs-navigation'
                aria-expanded='${() => sidebar.active ? 'true' : 'false'}'
                aria-label='${() => sidebar.active ? 'Close documentation navigation' : 'Open documentation navigation'}'
                class='header-sidebar button --background-grey'
                type='button'
                onclick='${() => sidebar.active = !sidebar.active}'
            >${icon({ 'aria-hidden': 'true' }, sidebarSvg)}</button>
            <a class='header-brand' href='${uri('docs')}' aria-label='Esportsplus UI home'>
                esportsplus<span class='header-brand-ui'> / ui</span>
            </a>

            <span
                class='header-version button button--flat'
                title='v${version}'
            >
                v${release}
            </span>

            <nav class='header-nav'>
                ${tabs.map((tab) => html`
                    <a
                        class='header-link ${() => request.data.route?.name?.startsWith(tab.name) && '--active'}'
                        href='${uri(tab.name)}'
                    >${tab.label}</a>
                `)}
            </nav>

            <div class='header-actions --flex-start'>
                ${searchTrigger('Quick search')}
                <a
                    aria-label='GitHub'
                    class='header-icon button --background-grey'
                    href='https://github.com/esportsplus/ui'
                    rel='noreferrer'
                    target='_blank'
                >
                    ${icon({ 'aria-hidden': 'true' }, githubSvg)}
                </a>
            </div>
        </div>
    </header>

    ${modal()}
`;
