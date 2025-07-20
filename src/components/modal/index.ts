import { isArray } from '@esportsplus/utilities';
import scrollbar from '~/components/scrollbar';
import './scss/index.scss';


export default (data: Parameters<typeof scrollbar>[0], content: unknown) => {
    if (!isArray(data.class)) {
        data.class = data.class ? [data.class] : [];
    }

    (data.class as unknown[]).push('modal');

    return scrollbar(data, content);
};