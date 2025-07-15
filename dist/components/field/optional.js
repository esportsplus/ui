import s from './select.js';
import sw from './switch.js';
import t from './text.js';
const select = (data) => {
    data.field ??= {};
    data.field.class = `field--optional ${data.field?.class || ''}`;
    data.field.content = s(data.field);
    return sw(data);
};
const text = (data) => {
    data.field ??= {};
    data.field.class = `field--optional ${data.field?.class || ''}`;
    data.field.content = t(data.field);
    return sw(data);
};
export default { select, text };
