import { config } from '@esportsplus/vite';
import { resolve } from 'path';
import { defineConfig, normalizePath } from 'vite';
import template from '@esportsplus/template/compiler/vite';
import exampleSource from './scripts/example-source.mjs';
import { layers } from '../vite.config.ts';
import tsconfig from './tsconfig.json' with { type: 'json' };


const LIBRARY_SCSS_PARTIAL = /^\/(shared|tokens)$/;

const REGEXP_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

// Vite's dev glob resolver needs aliases before configResolved runs.
const PATH_ALIASES = Object.entries(tsconfig.compilerOptions.paths)
    .sort(([a], [b]) => b.length - a.length)
    .map(([pattern, [target]]) => {
        let wildcard = pattern.endsWith('/*'),
            prefix = wildcard ? pattern.slice(0, -2) : pattern;

        const find = new RegExp(`^${prefix.replace(REGEXP_CHARACTERS, '\\$&')}${wildcard ? '(?=/|$)' : '$'}`);

        return {
            find,
            replacement: normalizePath(resolve(import.meta.dirname, wildcard ? target.slice(0, -2) : target))
        };
    });


export default defineConfig((env) => {
    return config({
        appType: 'spa',
        mode: env.mode,
        plugins: [
            exampleSource(),
            template(),
            layers
        ],
        resolve: {
            alias: [
                // Library SCSS imports its partials from the package root
                { find: LIBRARY_SCSS_PARTIAL, replacement: resolve(import.meta.dirname, '../$1.scss') },
                ...PATH_ALIASES
            ]
        }
    });
});
