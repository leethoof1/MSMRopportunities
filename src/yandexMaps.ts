import type * as YandexMaps from "@yandex/ymaps3-types";

declare global {
  interface Window {
    ymaps3?: typeof YandexMaps;
  }
}
export type YandexSDK = typeof YandexMaps;
let pending: Promise<YandexSDK> | undefined;

export function loadYandexMaps(apiKey: string): Promise<YandexSDK> {
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    let settled = false;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail(), 20000);
    function fail() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      pending = undefined;
      reject(new Error("Yandex Maps SDK could not be loaded"));
    }
    async function ready() {
      try {
        const sdk = window.ymaps3;
        if (!sdk) {
          fail();
          return;
        }
        await sdk.ready;
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(sdk);
      } catch {
        fail();
      }
    }
    if (window.ymaps3) {
      void ready();
      return;
    }
    const url = new URL("https://api-maps.yandex.ru/v3/");
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("lang", "ru_RU");
    script.src = url.toString();
    script.async = true;
    script.dataset.yandexMaps = "true";
    script.onload = () => {
      void ready();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return pending;
}
