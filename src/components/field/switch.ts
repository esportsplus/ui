import checkbox from './checkbox';


export default (data: Parameters<typeof checkbox>[0]) => {
    data.mask = data.mask || {};
    data.mask.class = `field-mask--switch ${data.mask?.class || ''}`;

    return checkbox(data);
};