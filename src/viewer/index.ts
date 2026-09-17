import './ui';
import { site, toaster } from '@esportsplus/ui';
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


// Render into a wrapper rather than document.body: the svg sprite runtime
// injects its <symbol> sheet as body's first child, and render() clears its
// target, which would wipe the sprite and blank every <use> icon.
const root = document.createElement('div');

root.style.display = 'contents';
document.body.append(root);

render(
    root,
    site(
        middleware(
            (request, next) => html`
                ${header}

                ${toaster({ position: 'bottom-right' })}

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
