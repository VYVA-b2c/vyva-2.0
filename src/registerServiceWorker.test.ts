import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { APP_VERSION } from "@/lib/appInfo";
import { getServiceWorkerBuildToken } from "./registerServiceWorker";

function appendScript(src: string) {
  const script = document.createElement("script");
  script.src = src;
  document.head.appendChild(script);
}

function clearScripts() {
  document.querySelectorAll("script").forEach((script) => script.remove());
}

describe("service worker registration", () => {
  beforeEach(() => {
    clearScripts();
  });

  afterEach(() => {
    clearScripts();
  });

  it("uses the Vite entry bundle filename as the build token", () => {
    appendScript("https://v2.vyva.life/assets/index-MDDD-QOO.js");

    expect(getServiceWorkerBuildToken()).toBe("index-MDDD-QOO.js");
  });

  it("falls back to the app version when the entry bundle is unavailable", () => {
    appendScript("https://v2.vyva.life/assets/vendor-B7kq.js");

    expect(getServiceWorkerBuildToken()).toBe(APP_VERSION);
  });
});
