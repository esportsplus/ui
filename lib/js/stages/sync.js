import { dom, emitter, throttle } from 'ui/lib';


emitter.on('dom.modified', throttle(() => dom.sync(document), 750));
emitter.once('dom.ready', () => dom.sync(document));
