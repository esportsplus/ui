// userAgentData is Chromium-only; the deprecated platform string still covers Safari and Firefox.
const mac = () => /mac|iphone|ipad/i.test(
    (navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData?.platform || navigator.platform
);


export { mac };
