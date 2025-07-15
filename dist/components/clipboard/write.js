export default async (value) => {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    }
    catch {
        return false;
    }
};
