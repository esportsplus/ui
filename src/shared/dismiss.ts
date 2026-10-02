// An 'ondocumentclick' handler that closes the element it is bound to, while open, on a click anywhere outside it.
export default (open: () => boolean, close: VoidFunction) => function(this: HTMLElement, e: MouseEvent) {
    if (open() && !this.contains(e.target as Node | null)) {
        close();
    }
};
