import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";

const config = [
  ...next,
  ...ts,
  { ignores: [".next/**", ".next-e2e/**", ".next-build/**", "next-env.d.ts", "node_modules/**", ".data/**", "test-results/**", "playwright-report/**"] },
];

export default config;
