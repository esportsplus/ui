// Declares the library's layer order before any layered stylesheet can claim a place in it.
import '@esportsplus/ui/layer.scss';
import './ui';
import { fallback, html, middleware, render } from 'docs/app';
import { toaster } from 'docs/components/toaster';
import { modal } from 'docs/components/search';
import { themeSwitcher } from 'docs/components/theme-switcher';
import sidebar, { state as sidebarState } from 'docs/components/sidebar';
import 'docs/data/theme';
import layout from 'docs/middleware/layout/index';
import missing from 'docs/middleware/missing/index';


render(
    document.body,
    {
        class: '--scrollbar'
    },
    () => html`${middleware(
        (request, next) => html`
            ${modal()}
            ${themeSwitcher()}
            ${toaster.content}

            <div
                class='viewer-body ${() => sidebarState.active && '--sidebar-open'}'
            >
                ${sidebar(request)}
                <div class='viewer-content'>
                    ${() => {
                        document.body.scrollTop = 0;

                        return next(request);
                    }}
                </div>
            </div>
        `,
        middleware.match(fallback),
        layout,
        missing,
        middleware.dispatch
    )}`
);
