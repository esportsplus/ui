import checkbox from './checkbox.js';
export default (data) => {
    data.mask = data.mask || {};
    data.mask.class = `field-mask--switch ${data.mask?.class || ''}`;
    return checkbox(data);
};
