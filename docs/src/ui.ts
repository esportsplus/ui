import '@esportsplus/ui/layer.scss';

import '@esportsplus/ui/normalize/scss/index.scss';

import '@esportsplus/ui/css-utilities/font/montserrat/scss/index.scss';
import '@esportsplus/ui/css-utilities/font/geist/scss/index.scss';

import '@esportsplus/ui/css-utilities/index.scss';

import '~/components/root/scss/index.scss';
import '~/components/viewer/scss/index.scss';
import '~/components/page/scss/index.scss';
import '~/components/spec/scss/index.scss';


// Vite hoists this eager glob above the explicit imports. The library build
// already wraps its styles in cascade layers, whose order index.ts declares.
import.meta.glob('@esportsplus/ui/components/*/scss/index.scss', { eager: true });
