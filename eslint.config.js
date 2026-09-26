import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "**/dist/**",
      "coverage/**",
      "release/**",
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
            "examples/demo-workspace/src/*.ts",
            "examples/demo-workspace/test/*.ts"
          ]
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
);
