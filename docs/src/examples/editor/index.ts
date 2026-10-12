import code from './code';
import diffs from './diffs';
import tree from './tree';
import type { Entry } from 'docs/types';


export default {
    name: 'editor',
    variants: [...code, ...tree, ...diffs]
} satisfies Entry;
