export default (value: string) => {
    let input = document.createElement('INPUT') as HTMLInputElement;

    document.body.appendChild(input);

    input.setAttribute('value', value);
    input.select();

    document.execCommand('copy');

    document.body.removeChild(input);
};