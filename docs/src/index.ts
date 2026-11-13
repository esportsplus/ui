// Declares the library's layer order before any layered stylesheet can claim a place in it.
import '@esportsplus/ui/layer.scss';
import './ui';
import { fallback, html, middleware, render } from 'docs/app';
import { toaster } from 'docs/components/toaster';
import { themeSwitcher } from 'docs/components/theme-switcher';
import panels from '@esportsplus/ui/components/panels';
import scrollbar from '@esportsplus/ui/modifiers/scrollbar';
import sidebar from 'docs/components/sidebar';
import missing from 'docs/middleware/missing/index';
import redirect from 'docs/middleware/redirect/index';
import 'docs/data/theme';


// The navigation as a static left sidebar beside the routed page, each a single surface that stays where it is. The
// navigation starts open on desktop and closed on small screens.
let layout = panels.state({
    open: { left: !matchMedia('(max-width: 1024px)').matches },
    root: {
        children: [
            {
                active: 'navigation',
                id: 'group-1',
                kind: 'group',
                placement: 'left',
                surfaces: [{ id: 'navigation', kind: 'navigation', sortable: false }]
            },
            {
                active: 'page',
                id: 'group-2',
                kind: 'group',
                surfaces: [{ id: 'page', kind: 'page', sortable: false }]
            }
        ],
        direction: 'row',
        id: 'split-1',
        kind: 'split',
        sizes: [0.25, 0.75]
    }
});


render(
    document.body,
    () => middleware(
        (request, next) => html`
            ${themeSwitcher()}
            ${toaster.content}

            ${panels({
                catalog: {
                    navigation: {
                        render: () => sidebar(request, layout),
                        title: 'Documentation navigation'
                    },
                    page: {
                        render: () => html`
                            <div class='viewer-scroll' ${scrollbar()}>
                                <div class='viewer-content'>
                                    ${() => {
                                        document.querySelector('.viewer-scroll')?.scrollTo(0, 0);

                                        return next(request);
                                    }}
                                </div>
                            </div>
                        `,
                        title: 'Page'
                    }
                },
                class: 'viewer-layout',
                sidebars: { left: { label: 'Documentation navigation', resizable: true } },
                state: layout
            })}
        `,
        middleware.match(fallback),
        redirect,
        missing,
        middleware.dispatch
    )
);
