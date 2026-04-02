import { describe, it, expect } from "vitest";
import {
  MATCHERS,
  URL_REGEX,
  WWW_REGEX,
  BARE_DOMAIN_REGEX,
  EMAIL_REGEX,
} from "@/components/editor/plugins/AutoLinkPlugin";

describe("AutoLinkPlugin matchers", () => {
  it("exports 4 matchers", () => {
    expect(MATCHERS).toHaveLength(4);
  });

  describe("URL_REGEX", () => {
    it("matches https URLs", () => {
      const match = URL_REGEX.exec("https://example.com");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("https://example.com");
    });

    it("matches http URLs", () => {
      const match = URL_REGEX.exec("http://example.com");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("http://example.com");
    });

    it("matches URLs with paths", () => {
      const match = URL_REGEX.exec("https://example.com/path/to/page");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("https://example.com/path/to/page");
    });

    it("matches URLs with query strings", () => {
      const match = URL_REGEX.exec("https://example.com/search?q=hello&page=1");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("https://example.com/search?q=hello&page=1");
    });

    it("matches URLs with fragments", () => {
      const match = URL_REGEX.exec("https://example.com/page#section");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("https://example.com/page#section");
    });

    it("does not match plain text", () => {
      expect(URL_REGEX.exec("hello world")).toBeNull();
    });

    it("does not match bare domain", () => {
      expect(URL_REGEX.exec("example.com")).toBeNull();
    });
  });

  describe("WWW_REGEX", () => {
    it("matches www URLs", () => {
      const match = WWW_REGEX.exec("www.example.com");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("www.example.com");
    });

    it("matches www URLs with paths", () => {
      const match = WWW_REGEX.exec("www.example.com/about");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("www.example.com/about");
    });

    it("does not match without www prefix", () => {
      expect(WWW_REGEX.exec("example.com")).toBeNull();
    });
  });

  describe("EMAIL_REGEX", () => {
    it("matches email addresses", () => {
      const match = EMAIL_REGEX.exec("user@example.com");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("user@example.com");
    });

    it("matches email with dots in local part", () => {
      const match = EMAIL_REGEX.exec("first.last@example.com");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("first.last@example.com");
    });

    it("matches email with subdomain", () => {
      const match = EMAIL_REGEX.exec("hello@sub.my-domain.co.uk");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("hello@sub.my-domain.co.uk");
    });

    it("does not match plain text", () => {
      expect(EMAIL_REGEX.exec("hello world")).toBeNull();
    });

    it("does not match URL", () => {
      expect(EMAIL_REGEX.exec("https://example.com")).toBeNull();
    });
  });

  describe("BARE_DOMAIN_REGEX", () => {
    it("matches simple domains", () => {
      const match = BARE_DOMAIN_REGEX.exec("example.com");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("example.com");
    });

    it("matches domains with paths", () => {
      const match = BARE_DOMAIN_REGEX.exec("example.com/about");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("example.com/about");
    });

    it("matches domains with query strings", () => {
      const match = BARE_DOMAIN_REGEX.exec("example.com/search?q=test");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("example.com/search?q=test");
    });

    it("matches subdomains", () => {
      const match = BARE_DOMAIN_REGEX.exec("docs.google.com");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("docs.google.com");
    });

    it("matches .io domains", () => {
      const match = BARE_DOMAIN_REGEX.exec("github.io");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("github.io");
    });

    it("matches .co.uk domains", () => {
      const match = BARE_DOMAIN_REGEX.exec("example.co.uk");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("example.co.uk");
    });

    it("matches .dev domains", () => {
      const match = BARE_DOMAIN_REGEX.exec("mysite.dev");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("mysite.dev");
    });

    it("matches .ai domains", () => {
      const match = BARE_DOMAIN_REGEX.exec("claude.ai");
      expect(match).not.toBeNull();
      expect(match![0]).toBe("claude.ai");
    });

    it("does not match plain text", () => {
      expect(BARE_DOMAIN_REGEX.exec("hello world")).toBeNull();
    });

    it("does not match words with dots but no valid TLD", () => {
      expect(BARE_DOMAIN_REGEX.exec("hello.there")).toBeNull();
    });
  });
});
