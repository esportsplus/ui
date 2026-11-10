import type { Entry } from 'docs/types';


const entries = Object.values(import.meta.glob<Entry>([
    './*.ts',
    './*/index.ts',
    '!./index.ts',
    '!./groups.ts',
    '!./form-options/index.ts'
], { eager: true, import: 'default' }))
    .sort((a, b) => a.name.localeCompare(b.name));


export { entries };
