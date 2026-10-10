import type { Next, Request as Req, Router as R } from '@esportsplus/routing/client';
import { router } from '@esportsplus/routing/client';
import type { Renderable } from '@esportsplus/template';
import type { Page } from 'docs/types';
import components from 'docs/actions/components';
import modifiers from 'docs/actions/modifiers';
import fallback from 'docs/actions/fallback';
import fonts from 'docs/actions/fonts';
import installation from 'docs/actions/installation/index';
import surfaces from 'docs/actions/surfaces';
import themes from 'docs/actions/themes';
import tokens from 'docs/actions/tokens/index';


type Response = Page | Renderable<unknown>;

type Request = Req<Response>;

type Responder = Next<Response>;

type Router = R<Response>;


export const { back, forward, middleware, redirect, uri } = router(components, fonts, installation, modifiers, surfaces, themes, tokens);
export { computed, effect, reactive, root, signal } from '@esportsplus/reactivity';
export { html, render } from '@esportsplus/template';
export { fallback };
export type { Renderable, Request, Responder, Response, Router };
export type RouteName = Parameters<typeof uri>[0];
