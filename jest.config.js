module.exports = {
  transform: {
    "^.+\\.ts?$": "ts-jest",
  },
  testRegex: "(/__test__/.*|(\\.|/)(test|spec))\\.(js?|ts?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
};
