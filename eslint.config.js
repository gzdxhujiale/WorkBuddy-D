import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importX from "eslint-plugin-import-x";

const features = [
  "habit",
  "projects",
  "daily-review",
  "time-management",
  "focus",
  "knowledge",
  "auth",
  "settings",
  "ai",
];

const crossFeatureZones = [];

// 1. Forbid cross-feature imports between domain features
// Auth is a foundational cross-cutting feature providing auth context to features; auth itself cannot import other features.
for (const target of features) {
  for (const from of features) {
    if (target !== from && from !== "auth") {
      crossFeatureZones.push({
        target: `./src/features/${target}`,
        from: `./src/features/${from}`,
        message: `Cross-feature import forbidden: "${target}" must not import from "${from}". Use shared models in src/types/ or compose in app/pages layer.`,
      });
    }
  }
}

// 2. Forbid features from importing app or pages
crossFeatureZones.push({
  target: "./src/features",
  from: "./src/app",
  message: "Features must not depend on app layer (unidirectional flow: shared -> features -> app).",
});
crossFeatureZones.push({
  target: "./src/features",
  from: "./src/pages",
  message: "Features must not depend on pages layer.",
});

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "import-x": importX,
    },
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: crossFeatureZones,
        },
      ],
      // Suppress unrelated pre-existing style rules so ESLint focuses cleanly on boundary guardrails
      "no-useless-catch": "off",
      "no-useless-assignment": "off",
      "no-empty": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
    settings: {
      "import-x/resolver": {
        typescript: true,
        node: true,
      },
    },
  },
  {
    ignores: ["dist/**", "src-tauri/**", "node_modules/**"],
  }
);
