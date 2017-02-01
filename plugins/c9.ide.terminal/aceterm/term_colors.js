define(function(require, exports, module) {

/**
 * Colors
 */
module.exports = function setColors(fg, bg, colors) {
    bg = bg || '#000000';
    fg = fg || '#f0f0f0';
    
    // Colors 0-15
    if (!colors) {
        colors = [
          // dark:
          '#2e3436',
          '#cc0000',
          '#4e9a06',
          '#c4a000',
          '#3465a4',
          '#75507b',
          '#06989a',
          '#d3d7cf',
          // bright:
          '#555753',
          '#ef2929',
          '#8ae234',
          '#fce94f',
          '#729fcf',
          '#ad7fa8',
          '#34e2e2',
          '#eeeeec'
        ];
    }
    
    function hex(c) {
        c = c.toString(16);
        return c.length < 2 ? '0' + c : c;
    }
    
    function parseColor(color) {
        if (color[0] == "#")
            return color.match(/^#(..)(..)(..)/).slice(1).map(function(c) {
                return parseInt(c, 16);
            });
        else
            return color.match(/\(([^,]+),([^,]+),([^,]+)/).slice(1).map(function(c) {
                return parseInt(c, 10);
            });
    }
    
    function out(r, g, b) {
        isVisible(r, g, b);
        colors.push('#' + hex(r) + hex(g) + hex(b));
    }
    
    /*
     L = 0.2126 * R + 0.7152 * G + 0.0722 * B where R, G and B are defined as:
    if RsRGB <= 0.03928 then R = RsRGB/12.92 else R = ((RsRGB+0.055)/1.055) ^ 2.4
    if GsRGB <= 0.03928 then G = GsRGB/12.92 else G = ((GsRGB+0.055)/1.055) ^ 2.4
    if BsRGB <= 0.03928 then B = BsRGB/12.92 else B = ((BsRGB+0.055)/1.055) ^ 2.4
    and RsRGB, GsRGB, and BsRGB are defined as:
    RsRGB = R8bit/255
    GsRGB = G8bit/255
    BsRGB = B8bit/255
    */
    
    function luma(r, g, b) {
        r = r / 255;
        g = g / 255;
        b = b / 255;
        var R = r <= 0.03928 ? r / 12.92 : ((r + 0.055) / 1.055) ^ 2.4;
        var G = g <= 0.03928 ? g / 12.92 : ((g + 0.055) / 1.055) ^ 2.4;
        var B = b <= 0.03928 ? b / 12.92 : ((b + 0.055) / 1.055) ^ 2.4;
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
        // return (0.21 * r + 0.72 * g + 0.07 * b) / 255;
    }
    function isVisible(r, g, b) {
        var ratio = (bgLuma + 0.05) / (luma(r, g, b) + 0.05);
        return ratio > 2 || ratio < 1 / 2;
    }
    
    var bgLuma = luma.apply(null, parseColor(bg));
    
    var overridenColors = Object.create(null);
    
    // Colors 16-255
    // Much thanks to TooTallNate for writing this.
    var r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff];
    
    // 16-231
    for (var i = 0; i < 216; i++) {
        out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
    }
    
    // 232-255 (grey)
    for (i = 0; i < 24; i++) {
        r = 8 + i * 10;
        out(r, r, r);
    }
    
    // Default BG/FG
    this.defaultColors = { bg: bg, fg: fg };
    
    colors[256] = this.defaultColors.bg;
    colors[257] = this.defaultColors.fg;
    this.colors = colors;
    this.overridenColors = overridenColors;
};

});