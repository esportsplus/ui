import './styles';

import { render } from '@esportsplus/template';
import { site } from '@esportsplus/ui';

import app from './app';


render(document.body, site({ class: '--scrollbar--full' }, app));
