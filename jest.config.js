export default {
  transform: {
    "^.+\\.ts?$": ["ts-jest", { useESM: true }],
  },
  moduleNameMapper: {
    '^(.*)\\.js$': '$1',
  },
  testRegex: "(/__test__/.*|(\\.|/)(test|spec))\\.(js?|ts?)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: ['./test/beforeEach.ts']
};
