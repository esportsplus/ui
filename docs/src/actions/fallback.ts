import { layout } from '../components/preview';
import { page } from './docs';
import type { Route } from '@esportsplus/routing/client';
import type { Renderable } from '../app';


const fallback: Route<Renderable<unknown>> = {
    handler: () => layout(page()),
    name: null,
    path: null,
    subdomain: null
};


export default fallback;
