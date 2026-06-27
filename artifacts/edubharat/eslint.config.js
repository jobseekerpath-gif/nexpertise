import js from "@eslint/js";
import ts from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default ts.config(
  { ignores: ["dist", "node_modules", "*.config.*"] },
  js.configs.recommended,
  ts.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // Keep the audit focused on accessibility; existing TypeScript issues
      // are not in scope for this pass.
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",

      // Core accessibility rules.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/no-noninteractive-tabindex": "error",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/label-has-associated-control": ["error", {
        required: { some: ["nesting", "id"] },
        controlComponents: ["Input", "Textarea", "Select", "SelectTrigger", "Switch", "Checkbox", "RadioGroupItem"],
      }],
    },
  }
);
