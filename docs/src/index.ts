import './ui';
import { fallback, html, middleware, render } from './app';
import header from './components/header';
import { notifications } from './components/notify';
import sidebar from './components/sidebar';


render(
    document.body,
    {
        class: `--font-montserrat --scrollbar`
    },
    middleware(
        (request, next) => html`
            ${header(request)}
            ${notifications.content}

            <div class='viewer-body'>
                ${sidebar(request)}
                ${() => {
                    document.body.scrollTop = 0;

                    return next(request);
                }}
            </div>
        `,
        middleware.match(fallback),
        middleware.dispatch
    )
);
