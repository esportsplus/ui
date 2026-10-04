export default (content: any[] | Record<PropertyKey, any>, name: string) => {
    let link = document.createElement('a'),
        url = URL.createObjectURL(new Blob(
            [ JSON.stringify(content) ],
            { type: 'application/json' }
        ));

    link.download = name + '.json';
    link.href = url;

    document.body.appendChild(link);

    link.click();
    link.remove();

    // Freed once the click has handed the blob to the download, which a synchronous revoke can cancel.
    setTimeout(() => URL.revokeObjectURL(url));
};