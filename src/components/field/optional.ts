import sel from './select';
import s from './switch';
import tex from './text';


const select = (data: Parameters<typeof s>[0] & { field: Parameters<typeof sel>[0] }) => {
    return s(Object.assign(data, {
        class: `field--optional ${data?.class || ''}`,
        field: {
            content: sel( data.field )
        }
    }));
};

const text = (data: Parameters<typeof s>[0] & { field: Parameters<typeof tex>[0] }) => {
    return s(Object.assign(data, {
        class: `field--optional ${data?.class || ''}`,
        field: {
            content: tex( data.field )
        }
    }));
};


export default { select, text };