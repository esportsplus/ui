import { html } from 'docs/app';
import { icon } from '@esportsplus/ui/components';
import breadcrumb from '@esportsplus/ui/components/breadcrumb';
import pagination from '@esportsplus/ui/components/pagination';
import { adjacent } from 'docs/data/nav';
import info from '@esportsplus/ui/svg/info.svg';
import type { Crumb } from '@esportsplus/ui/components/breadcrumb';
import type { Renderable } from 'docs/app';
import '@esportsplus/ui/components/page/scss/index.scss';
import './scss/index.scss';


type Header = {
    breadcrumb?: Crumb[];
    description: string;
    note?: Renderable<unknown>;
    title: string;
};


export default ({ breadcrumb: trail, description, note, title }: Header) => html`
    <div class='page-header'>
        ${trail && trail.length > 0 && breadcrumb({ class: 'page-header-breadcrumb', items: trail })}

        <div class='page-header-row'>
            <h1 class='page-title page-header-title'>${title}</h1>
            ${pagination.arrows({
                ...adjacent(),
                'aria-label': 'Page navigation',
                style: 'margin-left: auto;'
            })}
        </div>

        <p class='page-subtitle page-header-subtitle'>${description}</p>

        ${note && html`
            <div class='card page-note'>
                ${icon({ 'aria-hidden': 'true', class: 'page-note-icon' }, info)}
                <span>${note}</span>
            </div>
        `}
    </div>
`;
export type { Header };
