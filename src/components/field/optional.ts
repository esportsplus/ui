import s from './select';
import sw from './switch';
import t from './text';


const select = (data: Parameters<typeof sw>[0] & { field: Parameters<typeof s>[0] }) => {
    data.field ??= {} as typeof data.field;
    data.field.class = `field--optional ${data.field?.class || ''}`;
    data.field.content = s(data.field);

    return sw(data);
};

const text = (data: Parameters<typeof sw>[0] & { field: Parameters<typeof t>[0] }) => {
    data.field ??= {} as typeof data.field;
    data.field.class = `field--optional ${data.field?.class || ''}`;
    data.field.content = t(data.field);

    return sw(data);
};


export default { select, text };