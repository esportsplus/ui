import text from './text';


export default (data: Parameters<typeof text>[0]) => {
    data.textarea = true;

    return text(data);
};