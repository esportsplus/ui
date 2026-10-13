// Declares the library's layer order before any layered stylesheet can claim a place in it.
import '@esportsplus/ui/layer.scss';
import './ui';
import { fallback, html, middleware, render } from 'docs/app';
import { toaster } from 'docs/components/toaster';
import { modal } from 'docs/components/search';
import { themeSwitcher } from 'docs/components/theme-switcher';
import sidebar from 'docs/components/sidebar';
import missing from 'docs/middleware/missing/index';
import redirect from 'docs/middleware/redirect/index';
import scrollbar from '@esportsplus/ui/modifiers/scrollbar';
import 'docs/data/theme';


render(
    document.body,
    scrollbar(),
    () => middleware(
        (request, next) => html`
            ${modal()}
            ${themeSwitcher()}
            ${toaster.content}

            <div class='viewer-body ${() => sidebar.state.active && '--sidebar-open'}'>
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
        redirect,
        missing,
        middleware.dispatch
    )
);