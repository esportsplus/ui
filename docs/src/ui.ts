import '@esportsplus/ui/layer.scss';

import '@esportsplus/ui/css-utilities/font/montserrat.scss';
import '@esportsplus/ui/css-utilities/font/geist.scss';

import '~/css-utilities/index.scss';

import './components/root/scss/index.scss';
import './components/viewer/scss/index.scss';
import './components/page/scss/index.scss';
import './components/spec/scss/index.scss';


// Vite hoists this eager glob above the explicit imports, so every component's
// source SCSS is injected first. Where it lands doesn't matter: each library
// sheet is wrapped in its cascade layer as it compiles (the vite.config layers
// plugin), and the order of those layers is declared ahead of everything in
// index.ts.
import.meta.glob('../../src/components/*/scss/index.scss', { eager: true });