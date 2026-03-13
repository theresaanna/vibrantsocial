import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/__tests__/**",
        "src/types/**",
        "src/**/*.d.ts",
        "src/instrumentation.ts",
        "src/components/editor/**",
        "src/generated/**",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
        "src/app/**/page.tsx",
        "src/proxy.ts",
        "src/auth.ts",
        "src/app/sentry-example-page/**",
        "src/app/api/sentry-example-api/**",
        "src/app/privacy/**",
        "src/app/tos/**",
        "src/app/dmca/**",
      ],
    },
    server: {
      deps: {
        inline: ["next-auth", "next"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
