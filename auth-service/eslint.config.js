import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";

export default [
  {
    files: ["**/*.js"],
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "logs/**",
      "proto/**",
      "external/**"
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021
      },
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      import: importPlugin
    },
    rules: {
      ...js.configs.recommended.rules,

      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    //   "no-console": "off", // this is a microservice, logs matter

      // Imports clean-up
      "import/no-unresolved": "error",
      "import/no-duplicates": "error",
      "import/newline-after-import": "error",

      // Style / consistency
      "prefer-const": "error",
      "arrow-body-style": ["error", "as-needed"],
      "no-var": "error",

      // Safety
      "eqeqeq": "error",
      "no-useless-catch": "error",
      "no-empty-function": "warn",

      // Allow top-level await (useful in microservices)
      "no-await-in-loop": "off"
    }
  }
];
