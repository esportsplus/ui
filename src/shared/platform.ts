const APPLE_PLATFORM = /mac|iphone|ipad/i;


// userAgentData is Chromium-only; the deprecated platform string still covers Safari and Firefox.
const mac = () => APPLE_PLATFORM.test(
    (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData?.platform || navigator.platform
);


export { mac };
