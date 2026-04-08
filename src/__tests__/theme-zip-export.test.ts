/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { validateThemeExport } from "@/lib/theme-export";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";

const validColors = {
  profileBgColor: "#ffffff",
  profileTextColor: "#18181b",
  profileLinkColor: "#2563eb",
  profileSecondaryColor: "#71717a",
  profileContainerColor: "#f4f4f5",
};

const validThemeJson = {
  version: 1,
  colors: validColors,
  containerOpacity: 90,
  background: {
    imageUrl: null,
    repeat: "no-repeat",
    attachment: "scroll",
    size: "contain",
    position: "center",
  },
};

describe("validateThemeExport — imageFile field", () => {
  it("accepts export with imageFile string", () => {
    const data = {
      ...validThemeJson,
      background: {
        ...validThemeJson.background,
        imageFile: "background.png",
      },
    };
    const result = validateThemeExport(data);
    expect(result).not.toBeNull();
    expect(result!.background.imageFile).toBe("background.png");
  });

  it("rejects export with non-string imageFile", () => {
    const data = {
      ...validThemeJson,
      background: {
        ...validThemeJson.background,
        imageFile: 123,
      },
    };
    expect(validateThemeExport(data)).toBeNull();
  });

  it("accepts export without imageFile (legacy format)", () => {
    const result = validateThemeExport(validThemeJson);
    expect(result).not.toBeNull();
    expect(result!.background.imageFile).toBeUndefined();
  });

  it("accepts export with both imageData and imageFile", () => {
    const data = {
      ...validThemeJson,
      background: {
        ...validThemeJson.background,
        imageData: "data:image/png;base64,abc",
        imageFile: "background.png",
      },
    };
    const result = validateThemeExport(data);
    expect(result).not.toBeNull();
    expect(result!.background.imageData).toBe("data:image/png;base64,abc");
    expect(result!.background.imageFile).toBe("background.png");
  });
});

describe("zip round-trip — theme.json + background image", () => {
  it("creates a zip with theme.json and can unzip it", () => {
    const jsonBytes = strToU8(JSON.stringify(validThemeJson, null, 2));
    const zipped = zipSync({ "theme.json": jsonBytes });

    const unzipped = unzipSync(zipped);
    expect(unzipped["theme.json"]).toBeDefined();

    const parsed = JSON.parse(strFromU8(unzipped["theme.json"]));
    expect(parsed.version).toBe(1);
    expect(parsed.colors).toEqual(validColors);
  });

  it("bundles a background image file in the zip", () => {
    const themeWithImage = {
      ...validThemeJson,
      background: {
        ...validThemeJson.background,
        imageUrl: "https://blob.vercel-storage.com/test.png",
        imageFile: "background.png",
      },
    };

    const jsonBytes = strToU8(JSON.stringify(themeWithImage, null, 2));
    const fakeImageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header

    const zipped = zipSync({
      "theme.json": jsonBytes,
      "background.png": fakeImageBytes,
    });

    const unzipped = unzipSync(zipped);
    expect(unzipped["theme.json"]).toBeDefined();
    expect(unzipped["background.png"]).toBeDefined();

    // Verify image bytes are preserved
    const recoveredImage = unzipped["background.png"];
    expect(recoveredImage[0]).toBe(0x89);
    expect(recoveredImage[1]).toBe(0x50);
    expect(recoveredImage[2]).toBe(0x4e);
    expect(recoveredImage[3]).toBe(0x47);

    // Verify theme.json references the image file
    const parsed = JSON.parse(strFromU8(unzipped["theme.json"]));
    const validated = validateThemeExport(parsed);
    expect(validated).not.toBeNull();
    expect(validated!.background.imageFile).toBe("background.png");
  });

  it("creates a zip without image when no custom background", () => {
    const jsonBytes = strToU8(JSON.stringify(validThemeJson, null, 2));
    const zipped = zipSync({ "theme.json": jsonBytes });

    const unzipped = unzipSync(zipped);
    expect(Object.keys(unzipped)).toEqual(["theme.json"]);
  });

  it("zip starts with PK header for detection", () => {
    const jsonBytes = strToU8(JSON.stringify(validThemeJson, null, 2));
    const zipped = zipSync({ "theme.json": jsonBytes });

    expect(zipped[0]).toBe(0x50); // P
    expect(zipped[1]).toBe(0x4b); // K
  });

  it("non-zip data does not start with PK", () => {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(validThemeJson));
    expect(jsonBytes[0]).not.toBe(0x50);
  });
});

describe("zip import — image file resolution", () => {
  it("validates theme.json inside a zip", () => {
    const themeWithImage = {
      ...validThemeJson,
      background: {
        ...validThemeJson.background,
        imageFile: "background.jpg",
      },
    };

    const jsonBytes = strToU8(JSON.stringify(themeWithImage, null, 2));
    const fakeImage = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG header

    const zipped = zipSync({
      "theme.json": jsonBytes,
      "background.jpg": fakeImage,
    });

    const unzipped = unzipSync(zipped);
    const parsed = JSON.parse(strFromU8(unzipped["theme.json"]));
    const validated = validateThemeExport(parsed);

    expect(validated).not.toBeNull();
    expect(validated!.background.imageFile).toBe("background.jpg");
    expect(unzipped[validated!.background.imageFile!]).toBeDefined();
  });

  it("handles zip where imageFile references missing file gracefully", () => {
    const themeWithImage = {
      ...validThemeJson,
      background: {
        ...validThemeJson.background,
        imageFile: "missing.png",
      },
    };

    const jsonBytes = strToU8(JSON.stringify(themeWithImage, null, 2));
    const zipped = zipSync({ "theme.json": jsonBytes });

    const unzipped = unzipSync(zipped);
    const parsed = JSON.parse(strFromU8(unzipped["theme.json"]));
    const validated = validateThemeExport(parsed);

    expect(validated).not.toBeNull();
    expect(validated!.background.imageFile).toBe("missing.png");
    expect(unzipped["missing.png"]).toBeUndefined();
  });

  it("supports different image extensions (webp, gif, png, jpg)", () => {
    for (const ext of ["webp", "gif", "png", "jpg"]) {
      const filename = `background.${ext}`;
      const theme = {
        ...validThemeJson,
        background: {
          ...validThemeJson.background,
          imageFile: filename,
        },
      };

      const jsonBytes = strToU8(JSON.stringify(theme, null, 2));
      const fakeImage = new Uint8Array([1, 2, 3, 4]);

      const zipped = zipSync({
        "theme.json": jsonBytes,
        [filename]: fakeImage,
      });

      const unzipped = unzipSync(zipped);
      expect(unzipped[filename]).toBeDefined();
      expect(unzipped[filename].length).toBe(4);
    }
  });
});
