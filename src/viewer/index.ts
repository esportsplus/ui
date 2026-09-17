import './ui';
import { site } from '@esportsplus/ui';
import { effect, fallback, html, middleware, render, state, url } from '~/viewer/app';
import header from '~/viewer/components/header';
import sidebar from '~/viewer/components/sidebar';


effect(() => {
    state.section;
    state.slug;

    requestAnimationFrame(() => {
        let element = document.querySelector('.site');

        if (element) {
            element.scrollTop = 0;
        }
    });
});


render(
    document.body,
    site(
        { class: '--scrollbar--full' },
        middleware(
            (request, next) => html`
                ${header}

                <div class='viewer-body'>
                    ${sidebar}

                    ${() => {
                        url.path;

                        return next(request);
                    }}
                </div>
            `,
            middleware.match(fallback),
            (request, next) => {
                let name = request.data.route?.name ?? '';

                state.section = name === '' || name === 'home' ? 'docs' : name.replace('.detail', '');
                state.slug = request.data.parameters?.slug ?? '';

                return next(request);
            },
            middleware.dispatch
        )
    )
);
