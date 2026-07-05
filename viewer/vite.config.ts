import { config } from '@esportsplus/vite';
import { resolve } from 'node:path';
import { type ConfigEnv } from 'vite';

import compiler from '@esportsplus/template/compiler/vite';


export default ({ mode }: ConfigEnv) => config({
    mode,
    plugins: [compiler()],
    resolve: {
        alias: {
            // pin self-import to live source so alert/tooltip share one module instance with the viewer, not the stale build/ bundle
            '@esportsplus/ui': resolve(import.meta.dirname, '../src/components/index.ts')
        }
    },
    root: import.meta.dirname
});
