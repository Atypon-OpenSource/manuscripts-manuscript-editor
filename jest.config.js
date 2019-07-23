module.exports = {
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  setupFilesAfterEnv: ['./src/tests.ts'],
  snapshotSerializers: ['enzyme-to-json/serializer'],
  testPathIgnorePatterns: ['/node_modules/'],
  testRegex: '__tests__.*\\.test\\.tsx?$',
  transform: {
    '^.+\\.(j|t)sx?$': 'babel-jest',
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/(?!(lodash-es|@manuscripts)/)'],
}
