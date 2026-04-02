import { describe, it, expect } from "vitest";
import {
  detectInAppBrowser,
  buildIntentUrl,
} from "@/lib/in-app-browser";

// ---------------------------------------------------------------------------
// Real-world user agent strings
// ---------------------------------------------------------------------------
const UA = {
  // In-app browsers — Android
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.0.0 Mobile Safari/537.36 Instagram 308.0.0.0.0",
  tiktokAndroid:
    "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/106.0.5249.126 Mobile Safari/537.36 BytedanceWebview/d8a21c6",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/113.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/420.0.0.0;]",
  twitterAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 Twitter Android",
  snapchatAndroid:
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Snapchat/12.00 Chrome/110.0.0.0 Mobile Safari/537.36",

  // In-app browsers — iOS
  instagramIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A328 Instagram 306.0.0.0.0",
  tiktokIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BytedanceWebview/2.0",
  facebookIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21B74 [FBAN/FBIOS;FBAV/435.0.0.0]",
  twitterIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone",
  snapchatIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Snapchat/12.48.0",
  linkedinIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21A328 LinkedInApp",
  pinterestIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/20G75 Pinterest for iOS",

  // Normal browsers
  chromeDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  safariIOS:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  chromeMobile:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  firefoxDesktop:
    "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
};

describe("detectInAppBrowser", () => {
  describe("Android in-app browsers", () => {
    it("detects Instagram on Android", () => {
      const result = detectInAppBrowser(UA.instagramAndroid);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "android",
        app: "Instagram",
      });
    });

    it("detects TikTok on Android", () => {
      const result = detectInAppBrowser(UA.tiktokAndroid);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "android",
        app: "TikTok",
      });
    });

    it("detects Facebook on Android", () => {
      const result = detectInAppBrowser(UA.facebookAndroid);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "android",
        app: "Facebook",
      });
    });

    it("detects Twitter on Android", () => {
      const result = detectInAppBrowser(UA.twitterAndroid);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "android",
        app: "Twitter",
      });
    });

    it("detects Snapchat on Android", () => {
      const result = detectInAppBrowser(UA.snapchatAndroid);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "android",
        app: "Snapchat",
      });
    });
  });

  describe("iOS in-app browsers", () => {
    it("detects Instagram on iOS", () => {
      const result = detectInAppBrowser(UA.instagramIOS);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "ios",
        app: "Instagram",
      });
    });

    it("detects TikTok on iOS", () => {
      const result = detectInAppBrowser(UA.tiktokIOS);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "ios",
        app: "TikTok",
      });
    });

    it("detects Facebook on iOS", () => {
      const result = detectInAppBrowser(UA.facebookIOS);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "ios",
        app: "Facebook",
      });
    });

    it("detects Twitter on iOS", () => {
      const result = detectInAppBrowser(UA.twitterIOS);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "ios",
        app: "Twitter",
      });
    });

    it("detects Snapchat on iOS", () => {
      const result = detectInAppBrowser(UA.snapchatIOS);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "ios",
        app: "Snapchat",
      });
    });

    it("detects LinkedIn on iOS", () => {
      const result = detectInAppBrowser(UA.linkedinIOS);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "ios",
        app: "LinkedIn",
      });
    });

    it("detects Pinterest on iOS", () => {
      const result = detectInAppBrowser(UA.pinterestIOS);
      expect(result).toEqual({
        isInAppBrowser: true,
        platform: "ios",
        app: "Pinterest",
      });
    });
  });

  describe("Normal browsers", () => {
    it("returns false for Chrome desktop", () => {
      expect(detectInAppBrowser(UA.chromeDesktop)).toEqual({
        isInAppBrowser: false,
      });
    });

    it("returns false for Safari iOS", () => {
      expect(detectInAppBrowser(UA.safariIOS)).toEqual({
        isInAppBrowser: false,
      });
    });

    it("returns false for Chrome mobile", () => {
      expect(detectInAppBrowser(UA.chromeMobile)).toEqual({
        isInAppBrowser: false,
      });
    });

    it("returns false for Firefox desktop", () => {
      expect(detectInAppBrowser(UA.firefoxDesktop)).toEqual({
        isInAppBrowser: false,
      });
    });

    it("returns false for empty string", () => {
      expect(detectInAppBrowser("")).toEqual({ isInAppBrowser: false });
    });
  });
});

describe("buildIntentUrl", () => {
  it("builds correct intent URL from https URL", () => {
    const result = buildIntentUrl("https://links.vibrantsocial.app/alice");
    expect(result).toBe(
      "intent://links.vibrantsocial.app/alice#Intent;scheme=https;action=android.intent.action.VIEW;end"
    );
  });

  it("strips http:// scheme", () => {
    const result = buildIntentUrl("http://example.com/path");
    expect(result).toBe(
      "intent://example.com/path#Intent;scheme=https;action=android.intent.action.VIEW;end"
    );
  });

  it("handles URLs with query strings and fragments", () => {
    const result = buildIntentUrl("https://links.vibrantsocial.app/bob?ref=ig#top");
    expect(result).toBe(
      "intent://links.vibrantsocial.app/bob?ref=ig#top#Intent;scheme=https;action=android.intent.action.VIEW;end"
    );
  });

  it("handles root URL", () => {
    const result = buildIntentUrl("https://links.vibrantsocial.app/");
    expect(result).toBe(
      "intent://links.vibrantsocial.app/#Intent;scheme=https;action=android.intent.action.VIEW;end"
    );
  });
});
