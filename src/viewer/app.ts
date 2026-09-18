import type { Next, Request as Req, Router as R } from '@esportsplus/routing/client';
import { router } from '@esportsplus/routing/client';
import type { Renderable } from '@esportsplus/template';
import components from '~/viewer/actions/components';
import cssUtilities from '~/viewer/actions/css-utilities';
import docs from '~/viewer/actions/docs';
import fallback from '~/viewer/actions/fallback';
import fonts from '~/viewer/actions/fonts';
import themes from '~/viewer/actions/themes';
import tokens from '~/viewer/actions/tokens';


type Request = Req<Renderable<unknown>>;

type Responder = Next<Renderable<unknown>>;

type Router = R<Renderable<unknown>>;


export const { back, forward, middleware, redirect, uri } = router(components, cssUtilities, docs, fonts, themes, tokens);
export { computed, effect, reactive, root, signal } from '@esportsplus/reactivity';
export { html, render } from '@esportsplus/template';
export { fallback };
export type { Renderable, Request, Responder, Router };
export type RouteName = Parameters<typeof uri>[0];
