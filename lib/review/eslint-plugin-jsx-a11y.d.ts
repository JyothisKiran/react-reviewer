declare module "eslint-plugin-jsx-a11y" {
  import type { Linter } from "eslint";

  type ConfigPlugin = NonNullable<NonNullable<Linter.Config["plugins"]>[string]>;
  const jsxA11y: {
    meta?: ConfigPlugin["meta"];
    rules: NonNullable<ConfigPlugin["rules"]>;
    flatConfigs: { recommended: Linter.Config };
  };
  export default jsxA11y;
}
