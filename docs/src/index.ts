// Declares the library's layer order before any layered stylesheet can claim a place in it.
import '@esportsplus/ui/layer.scss';
import './ui';
import { fallback, html, middleware, reactive, render } from 'docs/app';
import { toaster } from 'docs/components/toaster';
import { modal } from 'docs/components/search';
import { themeSwitcher } from 'docs/components/theme-switcher';
import shell from '@esportsplus/ui/components/shell';
import sidebar from 'docs/components/sidebar';
import missing from 'docs/middleware/missing/index';
import redirect from 'docs/middleware/redirect/index';
import 'docs/data/theme';


// An empty right sidebar for now.
let panel = { id: 'docs-panel', label: 'Panel', state: reactive({ active: false }) };


render(
    document.body,
    () => middleware(
        (request, next) => html`
            ${modal()}
            ${themeSwitcher()}
            ${toaster.content}

            ${shell({ left: sidebar(request), right: panel }, html`
                <div class='viewer-content'>
                    ${() => {
                        document.querySelector('.shell-main')?.scrollTo(0, 0);

                        return next(request);
                    }}
                </div>
            `)}
        `,
        middleware.match(fallback),
        redirect,
        missing,
        middleware.dispatch
    )
);
