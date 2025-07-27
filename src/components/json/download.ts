export default (content: any[] | Record<PropertyKey, any>, name: string) => {
    let link = document.createElement('a');

    link.download = name + '.json';
    link.href = window.URL.createObjectURL(new Blob(
        [ JSON.stringify(content) ],
        { type: 'application/json' }
    ));

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
};