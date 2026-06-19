import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Treat `_`-prefixed args/vars as intentional skips. Used widely in
  // test mocks where Supabase chain callbacks receive a table argument
  // we don't read, and in destructuring patterns where one branch is
  // unused. Without this opt-out we'd churn on cosmetic warnings.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
      // Disabled when eslint-config-next bumped 16.1.6 → 16.2.4 alongside
      // the next security patch (HTTP smuggling / CSRF advisories). 16.2's
      // config newly enables React Compiler readiness rules that flagged
      // 26 pre-existing patterns across 12 files — too broad a refactor
      // to bundle with a security bump. Tracked as a deliberate
      // React-Compiler-readiness pass; turn back on per-rule as files
      // are migrated.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
