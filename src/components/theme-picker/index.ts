import cards from './cards';
import swatches from './swatches';
import toggle from './toggle';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


const themePicker: { cards: typeof cards, swatches: typeof swatches, toggle: typeof toggle } = { cards, swatches, toggle };


export default themePicker;
export type { Theme } from './shared';
