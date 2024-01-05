let formatter: null | Intl.NumberFormat = null,
    suffixes = ['th', 'st', 'nd', 'rd'];


const abbreviate = (number: number) => {
    if (formatter === null) {
        formatter = new Intl.NumberFormat('en-GB', {
            notation: 'compact',
            compactDisplay: 'short'
        });
    }

    return formatter.format(number);
};

const ordinal = (number: number) => {
    let value = number % 100;

    return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
};


export default { abbreviate, ordinal };
export { abbreviate, ordinal };