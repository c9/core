define(function(require, exports, module) {
module.exports = {
  "catalog": {
    "product": {
      "@description": "Cardigan Sweater",
      "catalog_item": [{
        "@gender": "Men's",
        "item_number": "QWZ5671",
        "price": 39.95,
        "size": [{
          "@description": "Medium",
          "color_swatch": [{
            "@image": "red_cardigan.jpg",
            "$": "Red"
          }, {
            "@image": "burgundy_cardigan.jpg",
            "$": "Burgundy"
          }]
        }, {
          "@description": "Large",
          "color_swatch": [{
            "@image": "red_cardigan.jpg",
            "$": "Red"
          }, {
            "@image": "burgundy_cardigan.jpg",
            "$": "Burgundy"
          }]
        }]
      }, {
        "@gender": "Women's",
        "item_number": "RRX9856",
        "discount_until": "Dec 25, 1995",
        "price": 42.5,
        "size": {
          "@description": "Medium",
          "color_swatch": {
            "@image": "black_cardigan.jpg",
            "$": "Black"
          }
        }
      }]
    },
    "script": {
      "@type": "text/javascript",
      "$": "function matchwo(a,b) {\n    if (a < b && a < 0) { return 1; }\n    else { return 0; }\n}"
    }
  }
};
});
