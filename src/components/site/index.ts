import { toArray } from '@esportsplus/utilities';
import { onclick } from '~/components/root';
import scrollbar from '~/components/scrollbar';
import template from '~/components/template';
import './scss/index.scss';


export default template.factory<Parameters<typeof scrollbar>[0]>(
    (attributes, content) => {
        attributes.class = toArray(attributes.class);
        attributes.class.push('site');

        attributes.onclick = onclick;

        attributes.style ??= '--background-default: var(--color-black-400);';

        return scrollbar(attributes, content);
    }
);