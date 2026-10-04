// Declares the library's layer order before any layered stylesheet can claim a place in it.
import '@esportsplus/ui/layer.scss';
import './ui';
import { fallback, html, middleware, render } from '~/app';
import header from '~/components/header';
import { notifications } from '~/components/notify';
import sidebar, { state as sidebarState } from '~/components/sidebar';


render(
    document.body,
    {
        class: `--font-montserrat --scrollbar --scrollbar-scope`
    },
    middleware(
        (request, next) => html`
            ${header(request)}
            ${notifications.content}

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
        middleware.dispatch
    )
);
