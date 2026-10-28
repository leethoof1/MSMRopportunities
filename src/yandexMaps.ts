import type * as YandexMaps from "@yandex/ymaps3-types";

declare global {
  interface Window {
    ymaps3?: typeof YandexMaps;
  }
}
export type YandexSDK = typeof YandexMaps;
export type YandexFailureCode =
  | "YM-CONNECTION"
  | "YM-TIMEOUT"
  | "YM-SDK"
  | "YM-ACCESS"
  | "YM-RENDER"
  | "YM-INIT";
export class YandexSDKError extends Error {
  constructor(public readonly code: YandexFailureCode) {
    super(code);
  }
}
function readSDK(): YandexSDK | undefined {
  // A top-level lexical global is available as ymaps3 without being a Window property.
  return typeof ymaps3 !== "undefined" ? ymaps3 : window.ymaps3;
}
export function yandexFailureCode(error: unknown): YandexFailureCode {
  if (error instanceof YandexSDKError) return error.code;
  const message = error instanceof Error ? error.message : "";
  if (
    /api.?key|unauthorized|forbidden|access.denied|authentication|authorization|referer|referrer|ключ/i.test(
      message,
    )
  )
    return "YM-ACCESS";
  if (/webgl|gpu|rendering.context|graphics.context/i.test(message))
    return "YM-RENDER";
  return "YM-INIT";
}
let pending: Promise<YandexSDK> | undefined;

export function loadYandexMaps(apiKey: string): Promise<YandexSDK> {
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    let settled = false;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => fail("YM-TIMEOUT"), 20000);
    function fail(code: YandexFailureCode) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      pending = undefined;
      reject(new YandexSDKError(code));
    }
    async function ready() {
      try {
        const sdk = readSDK();
        if (!sdk) {
          fail("YM-SDK");
          return;
        }
        await sdk.ready;
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(sdk);
      } catch (error) {
        fail(yandexFailureCode(error));
      }
    }
    if (readSDK()) {
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
    script.onerror = () => fail("YM-CONNECTION");
    document.head.appendChild(script);
  });
  return pending;
}
