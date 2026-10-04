import '@esportsplus/ui/layer.scss';

import '@esportsplus/ui/normalize/scss/index.scss';

import '@esportsplus/ui/css-utilities/font/montserrat/scss/index.scss';
import '@esportsplus/ui/css-utilities/font/geist/scss/index.scss';

import '@esportsplus/ui/css-utilities/index.scss';

import 'docs/components/root/scss/index.scss';
import 'docs/components/viewer/scss/index.scss';
import 'docs/components/page/scss/index.scss';
import 'docs/components/spec/scss/index.scss';


// Vite hoists this eager glob above the explicit imports. The layers plugin
// wraps library source styles; index.ts declares their cascade layer order.
import.meta.glob('@esportsplus/ui/components/*/scss/index.scss', { eager: true });
