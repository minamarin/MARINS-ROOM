module.exports = {
  extends: ["@marins-room/config/eslint/next.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
