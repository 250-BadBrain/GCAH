import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "**/dist/**",
      "coverage/**",
      "**/*.d.ts"
    ]
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "*.js",
            "*.ts",
            "scripts/*.ts",
            "apps/webui/vite.config.ts",
            "examples/demo-workspace/src/*.ts",
            "examples/demo-workspace/test/*.ts"
          ]
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
);
