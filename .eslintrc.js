module.exports = {
  extends: "airbnb",
  rules: {
    "import/extensions": [2, "ignorePackages"],
    "no-underscore-dangle": [2, { allowAfterThis: true, allow: ["_id"] }],
    "react/prop-types": [0], // TODO: Add prop validation
    "react/destructuring-assignment": [0],
    "jsx-a11y/click-events-have-key-events": [0],
    "no-alert": [0],
    "consistent-return": [0],
    //new
    "max-len": [
      2,
      {
        code: 120,
        tabWidth: 4,
        ignoreTrailingComments: true,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true
      }
    ],
    "linebreak-style": [0]
  },
  parser: "babel-eslint",
  env: {
    browser: true,
    node: true
  }
};
