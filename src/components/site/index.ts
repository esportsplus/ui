import { isArray } from '@esportsplus/utilities';
import { onclick } from '~/components/root';
import scrollbar from '~/components/scrollbar';
import './scss/index.scss';


export default (data: Parameters<typeof scrollbar>[0], content: unknown) => {
    data.style ??= '--background-default: var(--color-black-400);';

    if (!isArray(data.class)) {
        data.class = data.class ? [data.class] : [];
    }

    (data.class as unknown[]).push('site');

    data.onclick = onclick;

    return scrollbar(data, content);
};