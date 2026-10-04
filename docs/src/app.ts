import type { Next, Request as Req, Router as R } from '@esportsplus/routing/client';
import { router } from '@esportsplus/routing/client';
import type { Renderable } from '@esportsplus/template';
import components from 'docs/actions/components';
import cssUtilities from 'docs/actions/css-utilities';
import docs from 'docs/actions/docs';
import fallback from 'docs/actions/fallback';
import fonts from 'docs/actions/fonts';
import themes from 'docs/actions/themes';
import tokens from 'docs/actions/tokens';


type Request = Req<Renderable<unknown>>;

type Responder = Next<Renderable<unknown>>;

type Router = R<Renderable<unknown>>;


export const { back, forward, middleware, redirect, uri } = router(components, cssUtilities, docs, fonts, themes, tokens);
export { computed, effect, reactive, root, signal } from '@esportsplus/reactivity';
export { html, render } from '@esportsplus/template';
export { fallback };
export type { Renderable, Request, Responder, Router };
export type RouteName = Parameters<typeof uri>[0];
