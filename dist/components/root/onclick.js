let queue = [];
const onclick = async () => {
    if (queue.length === 0) {
        return;
    }
    let item;
    while (item = queue.pop()) {
        await item();
    }
};
onclick.push = (fn) => {
    queue.push(fn);
};
export default onclick;
