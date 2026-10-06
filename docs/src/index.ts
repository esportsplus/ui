// Declares the library's layer order before any layered stylesheet can claim a place in it.
import '@esportsplus/ui/layer.scss';
import './ui';
import { fallback, html, middleware, render } from 'docs/app';
import { toaster } from 'docs/components/toaster';
import { modal } from 'docs/components/search';
import sidebar, { state as sidebarState } from 'docs/components/sidebar';
import layout from 'docs/middleware/layout/index';
import theme from '@esportsplus/ui/css-utilities/theme';


let mode = theme();


render(
    document.body,
    {
        class: [`--font-montserrat --scrollbar --scrollbar-scope`, () => mode.class]
    },
    () => html`${middleware(
        (request, next) => html`
            ${modal()}
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
        middleware.dispatch
    )}`
);
