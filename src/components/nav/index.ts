import spy from './spy';
import toc from './toc';
import tree from './tree';
import './scss/index.scss';


const nav: { spy: typeof spy, toc: typeof toc, tree: typeof tree } = { spy, toc, tree };


export default nav;
export type { Mode, Spy } from './spy';
export type { TocLink } from './toc';
export type { Current, Indicator, TreeGroup, TreeLink, TreeSection } from './tree';
