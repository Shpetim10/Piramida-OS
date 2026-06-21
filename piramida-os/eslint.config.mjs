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
  // The ported three.js / react-three-fiber scene (components/pyramid3d/**) relies
  // on imperative per-frame mutation of objects returned by hooks (camera.position,
  // OrbitControls.target, gl flags) inside useFrame — the standard r3f idiom. The
  // strict react-hooks immutability/ref rules don't apply to that render loop, so
  // they're scoped off for this vendored folder only.
  {
    files: ["components/pyramid3d/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
