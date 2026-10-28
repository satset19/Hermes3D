import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config headers caching policy", () => {
  it("includes /avatars/:path* with 1-year immutable caching header", async () => {
    expect(nextConfig.headers).toBeDefined();
    const headers = await nextConfig.headers!();

    const avatarEntry = headers.find((h) => h.source === "/avatars/:path*");
    expect(avatarEntry).toBeDefined();
    expect(avatarEntry?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    });
  });

  it("keeps /office-assets/:path* and /:path* security headers intact", async () => {
    const headers = await nextConfig.headers!();

    const officeAssetsEntry = headers.find((h) => h.source === "/office-assets/:path*");
    expect(officeAssetsEntry).toBeDefined();
    expect(officeAssetsEntry?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    });

    const rootEntry = headers.find((h) => h.source === "/:path*");
    expect(rootEntry).toBeDefined();
    const csp = rootEntry?.headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp?.value).toContain("default-src 'self'");
  });
});
