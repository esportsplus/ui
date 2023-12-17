let formatter: null | Intl.NumberFormat = null;


const abbreviate = (number: number) => {
    if (formatter === null) {
        formatter = new Intl.NumberFormat('en-GB', {
            notation: 'compact',
            compactDisplay: 'short'
        });
    }

    return formatter.format(number);
};


export default { abbreviate };