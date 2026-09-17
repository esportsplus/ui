import { effect, reactive } from '@esportsplus/reactivity';
import { router } from '@esportsplus/routing/client';
import components from './pages/components';
import cssUtilities from './pages/css-utilities';
import docs from './pages/docs';
import fonts from './pages/fonts';
import themes from './pages/themes';
import tokens from './pages/tokens';
import type { Request, Route, Router } from '@esportsplus/routing/client';
import type { Page } from './types';


type View = {
    page: Page;
    section: string;
    slug: string;
};


const DEFAULT_SECTION = 'docs';


function view(section: string, slug: string, factory: (slug: string) => Page): View {
    return {
        page: factory(slug),
        section,
        slug
    };
}


const app = router((r: Router<View>) => r
    .get({ name: 'components', path: '/components', responder: () => view('components', '', components) })
    .get({ name: 'components.detail', path: '/components/:slug', responder: (request) => view('components', request.data.parameters?.slug ?? '', components) })
    .get({ name: 'css-utilities', path: '/css-utilities', responder: () => view('css-utilities', '', cssUtilities) })
    .get({ name: 'css-utilities.detail', path: '/css-utilities/:slug', responder: (request) => view('css-utilities', request.data.parameters?.slug ?? '', cssUtilities) })
    .get({ name: 'docs', path: '/docs', responder: () => view('docs', '', docs) })
    .get({ name: 'fonts', path: '/fonts', responder: () => view('fonts', '', fonts) })
    .get({ name: 'home', path: '/', responder: () => view('docs', '', docs) })
    .get({ name: 'themes', path: '/themes', responder: () => view('themes', '', themes) })
    .get({ name: 'tokens', path: '/tokens', responder: () => view('tokens', '', tokens) })
);

const fallback: Route<View> = {
    handler: () => view('docs', '', docs),
    name: null,
    path: null,
    subdomain: null
};

const href = (section: string, slug?: string) => slug ? `/${section}/${slug}` : `/${section}`;

const match = app.middleware.match(fallback);

const url = reactive({ path: window.location.pathname });

const resolve = (): View => {
    // The match middleware reads its matched parameters in an untracked scope, so
    // a same-route navigation (only the path parameter changes) would not re-run
    // dispatch. Reading url.path subscribes callers to every navigation instead.
    url.path;

    return match({} as Request<View>, app.middleware.dispatch);
};

const state = reactive({ section: DEFAULT_SECTION, slug: '' });


const sync = () => {
    if (url.path !== window.location.pathname) {
        url.path = window.location.pathname;
    }
};


effect(() => {
    let current = resolve();

    state.section = current.section;
    state.slug = current.slug;
});

document.addEventListener('click', app.listener);
document.addEventListener('click', sync);
window.addEventListener('popstate', sync);


export { href, resolve, state };
