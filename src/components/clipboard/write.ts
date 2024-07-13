export default async (value: string) => {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    }
    catch {
        return false;
    }
};