import text from './text.js';
export default (data) => {
    data.textarea = true;
    return text(data);
};
