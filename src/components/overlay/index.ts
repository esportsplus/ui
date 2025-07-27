import { toArray } from '@esportsplus/utilities';
import scrollbar from '~/components/scrollbar';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory<Parameters<typeof scrollbar>[0]>(
    (attributes, content) => {
        attributes.class = toArray(attributes.class);
        attributes.class.push('overlay');

        return scrollbar(attributes, content);
    }
);