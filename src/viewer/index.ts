import '@esportsplus/ui/layer.scss';

import '@esportsplus/ui/anchor.scss';
import '@esportsplus/ui/banner.scss';
import '@esportsplus/ui/border.scss';
import '@esportsplus/ui/bubble.scss';
import '@esportsplus/ui/card.scss';
import '@esportsplus/ui/container.scss';
import '@esportsplus/ui/css-utilities.scss';
import '@esportsplus/ui/fonts';
import '@esportsplus/ui/grid.scss';
import '@esportsplus/ui/link.scss';
import '@esportsplus/ui/modal.scss';
import '@esportsplus/ui/normalize.scss';
import '@esportsplus/ui/page.scss';
import '@esportsplus/ui/text.scss';
import '@esportsplus/ui/themes/dark/button.scss';
import '@esportsplus/ui/themes/dark/link.scss';
import '@esportsplus/ui/thumbnail.scss';

import { render } from '@esportsplus/template';
import { site } from '@esportsplus/ui';

import index from './actions/index';


render(document.body, site({ class: 'scrollbar-container--full' }, index));
