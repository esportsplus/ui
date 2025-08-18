import { onclick } from '~/components/root';
import scrollbar from '~/components/scrollbar';
import './scss/index.scss';


export default scrollbar.bind({
    attributes: {
        class: 'site',
        onclick
    }
});