import sel from './select';
import s from './switch';
import tex from './text';


const select = (data: Parameters<typeof s>[0] & { field: Parameters<typeof sel>[0] }) => {
    data.field.content = sel(
        Object.assign(data.field || {}, {
            class: `field--optional ${data?.field?.class || ''}`
        })
    );

    return s(data);
};

const text = (data: Parameters<typeof s>[0] & { field: Parameters<typeof tex>[0] }) => {
    data.field.content = tex(
        Object.assign(data.field || {}, {
            class: `field--optional ${data?.field?.class || ''}`
        })
    );

    return s(data);
};


export default { select, text };