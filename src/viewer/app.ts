import { reactive } from '@esportsplus/reactivity';
import { router } from '@esportsplus/routing/client';
import components from '~/viewer/actions/components';
import cssUtilities from '~/viewer/actions/css-utilities';
import docs from '~/viewer/actions/docs';
import fallback from '~/viewer/actions/fallback';
import fonts from '~/viewer/actions/fonts';
import themes from '~/viewer/actions/themes';
import tokens from '~/viewer/actions/tokens';
import type { Next, Request, Router as R } from '@esportsplus/routing/client';
import type { Renderable } from '@esportsplus/template';


type Responder = Next<Renderable<unknown>>;

type Router = R<Renderable<unknown>>;


const instance = router(components, cssUtilities, docs, fonts, themes, tokens);

const state = reactive({ section: 'docs', slug: '' });

const url = reactive({ path: window.location.pathname });


const href = (section: string, slug?: string) => slug ? `/${section}/${slug}` : `/${section}`;

const sync = () => {
    if (url.path !== window.location.pathname) {
        url.path = window.location.pathname;
    }
};


document.addEventListener('click', instance.listener);
document.addEventListener('click', sync);
window.addEventListener('popstate', sync);


export const { back, forward, middleware, redirect, uri } = instance;
export { computed, effect, reactive, root, signal } from '@esportsplus/reactivity';
export { html, render } from '@esportsplus/template';
export { fallback, href, state, url };
export type { Renderable, Request, Responder, Router };
