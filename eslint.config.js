// @ts-check
const fs = require("node:fs");
const path = require("node:path");
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

const noFeaturesFromLayers = [
  {
    group: ["@features/*", "@features/**"],
    message: "core/ y shared/ nunca importan de features/ (dependencias en un solo sentido).",
  },
];

const noLongRelative = [
  {
    regex: "^(\\.\\./){3,}",
    message: "Usa los alias @core, @shared, @features, @config o @environments en vez de imports relativos largos.",
  },
];

// Una feature no importa el interior de otra: lo que dos features comparten vive en shared/ (o en core/). Una excepcion se anota con `// DT-92` en su archivo
// y se agrega aqui como override de esa feature (sin excepciones hoy).
const features = fs.readdirSync(path.join(__dirname, "src/app/features"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const noCrossFeature = features.map((feature) => ({
  files: [`src/app/features/${feature}/**/*.ts`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          ...noLongRelative,
          {
            group: features.filter((other) => other !== feature).map((other) => `@features/${other}`).flatMap((g) => [g, `${g}/**`]),
            message: "Una feature no importa el interior de otra: lo compartido se sube a shared/.",
          },
        ],
      },
    ],
  },
}));

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        { type: "attribute", prefix: "app", style: "camelCase" },
      ],
      "@angular-eslint/component-selector": [
        "error",
        { type: "element", prefix: "app", style: "kebab-case" },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": true, "ts-expect-error": "allow-with-description" }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-restricted-imports": ["error", { patterns: noLongRelative }],
    },
  },
  {
    files: ["src/app/core/**/*.ts", "src/app/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [...noFeaturesFromLayers, ...noLongRelative] }],
    },
  },
  ...noCrossFeature,
  {
    // Ruido: en los *.spec.ts el `!` sobre querySelector/resultados de prueba es idiomatico (~440 casos); no afecta a produccion.
    files: ["**/*.spec.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {},
  },
]);
