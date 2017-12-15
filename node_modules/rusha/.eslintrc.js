module.exports = {
  "parser": "babel-eslint",
  "extends": "eslint:recommended",
  "rules": {
    // enable additional rules
    "indent": ["error", 2],
    "linebreak-style": ["error", "unix"],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-var": "error",
    "no-cond-assign": ["error", "always"],
    "strict": ["error", "global"],

    // disable rules from base configurations
    "no-console": "off",
    "no-fallthrough": "off"
  },
  "globals": {
    "ArrayBuffer": true,
    "DataView": true,
    "Int8Array": true,
    "Int32Array": true,
    "Uint8Array": true
  }
};
