module.exports = {
  extends: ["@marins-room/config/eslint/node.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
