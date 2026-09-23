import './ui';
import { toaster } from '@esportsplus/ui';
import { fallback, html, middleware, render } from './app';
import header from './components/header';
import sidebar from './components/sidebar';


render(
    document.body,
    {
        class: `--font-montserrat --scrollbar`
    },
    middleware(
        (request, next) => html`
            ${header(request)}
            ${toaster({ position: 'bottom-right' })}

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
