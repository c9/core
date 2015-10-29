/**
 * Utilities for the Ajax.org Cloud IDE
 *
 * @copyright 2013, Ajax.org B.V.
 */
define(function(require, exports, module) {
    main.consumes = ["c9", "Plugin"];
    main.provides = ["util"];
    return main;

    function main(options, imports, register) {
        var c9 = imports.c9;
        var Plugin = imports.Plugin;
        var normalize = require("path").normalize;

        var plugin = new Plugin("Ajax.org", main.consumes);

        plugin.escapeXpathString = function(name) {
            if (!name)
                return "";
        
            if (name.indexOf('"') > -1) {
                var out = [];
                var parts = name.split('"');
                parts.each(function(part) {
                    out.push(part === "" ? "'\"'" : '"' + part + '"');
                });
                return "concat(" + out.join(", ") + ")";
            }
            return '"' + name + '"';
        };
        
        var SupportedIcons = {
            "application/xhtml+xml":"html",
            "text/css": "css",
            "text/x-scss": "css",
            "text/x-sass": "css",
            "text/html":"html",
            "application/pdf":"page_white_acrobat",
            "image":"image",
            "application/xml":"page_white_code_red",
            "image/svg+xml": "page_white_picture",
            "text/plain": "page_white_text",
            "application/javascript": "page_white_code",
            "application/json": "page_white_code",
            "text/x-script.python": "page_white_code",
            "text/x-script.ocaml": "page_white_code",
            "text/x-script.clojure": "page_white_code",
            "application/x-httpd-php": "page_white_php",
            "application/x-sh": "page_white_wrench",
            "text/x-coldfusion": "page_white_coldfusion",
            "text/x-script.ruby": "page_white_ruby",
            "text/x-script.coffeescript": "page_white_cup",
            "text/cpp": "page_white_cplusplus",
            "text/x-c": "page_white_c",
            "text/x-logiql": "logiql",
            "text/x-csharp": "page_white_csharp",
            "text/x-java-source": "page_white_cup",
            "text/x-markdown": "page_white_text",
            "text/x-xquery": "page_white_code"
        };
        
        var contentTypes = {
            "c9search": "text/x-c9search",
        
            "js": "application/javascript",
            "json": "application/json",
            "run": "application/javascript",
            "build": "application/javascript",
            "css": "text/css",
            "scss": "text/x-scss",
            "sass": "text/x-sass",
        
            "xml": "application/xml",
            "rdf": "application/rdf+xml",
            "rss": "application/rss+xml",
            "svg": "image/svg+xml",
            "wsdl": "application/wsdl+xml",
            "xslt": "application/xslt+xml",
            "atom": "application/atom+xml",
            "mathml": "application/mathml+xml",
            "mml": "application/mathml+xml",
        
            "php": "application/x-httpd-php",
            "phtml": "application/x-httpd-php",
            "html": "text/html",
            "xhtml": "application/xhtml+xml",
            "coffee": "text/x-script.coffeescript",
            "py": "text/x-script.python",
            "java": "text/x-java-source",
            "logic": "text/x-logiql",
        
            "ru": "text/x-script.ruby",
            "gemspec": "text/x-script.ruby",
            "rake": "text/x-script.ruby",
            "rb": "text/x-script.ruby",
        
            "c": "text/x-c",
            "cc": "text/x-c",
            "cpp": "text/x-c",
            "cxx": "text/x-c",
            "h": "text/x-c",
            "hh": "text/x-c",
            "hpp": "text/x-c",
        
            "bmp": "image",
            "djv": "image",
            "djvu": "image",
            "gif": "image",
            "ico": "image",
            "jpeg": "image",
            "jpg": "image",
            "pbm": "image",
            "pgm": "image",
            "png": "image",
            "pnm": "image",
            "ppm": "image",
            "psd": "image",
            "svgz": "image",
            "tif": "image",
            "tiff": "image",
            "xbm": "image",
            "xpm": "image",
        
            "clj": "text/x-script.clojure",
            "ml": "text/x-script.ocaml",
            "mli": "text/x-script.ocaml",
            "cfm": "text/x-coldfusion",
            "sql": "text/x-sql",
        
            "sh": "application/x-sh",
            "bash": "application/x-sh",
        
            "xq": "text/x-xquery",
        
            "terminal": "terminal"
        };
        
        plugin.getFileIcon = function(name) {
            var icon = "page_white_text";
            var ext;
        
            if (name) {
                ext = name.split(".").pop().toLowerCase();
                icon = SupportedIcons[contentTypes[ext]] || "page_white_text";
            }
            return icon;
        };
        
        plugin.getFileIconCss = function(staticPrefix) {
            function iconCss(name, icon) {
                return ".filetree-icon." + name + "{background-image:"
                    +"url(\"" + staticPrefix + "/icons/" + (icon || name) + ".png\")}";
            }
            var css = "";
            var added = {};
            for (var i in SupportedIcons) {
                var icon = SupportedIcons[i];
                if (!added[icon]) {
                    css += iconCss(icon) + "\n";
                    added[icon] = true;
                }
            }
            return css;
        };
        
        plugin.getContentType = function(filename) {
            var type = filename.split(".").pop().split("!").pop().toLowerCase() || "";
            return contentTypes[type] || "text/plain";
        };
        
        // taken from http://xregexp.com/
        plugin.escapeRegExp = function(str) {
            return str.replace(/[-[\]{}()*+?.,\\^$|#\s"']/g, "\\$&");
        };
        
        plugin.escapeXml = window.apf
            ? apf.escapeXML
            : function() { alert("oops! apf needed for this") };
        
        plugin.replaceStaticPrefix = function (string) {
            return string.replace(new RegExp("{c9.staticPrefix}", "g"), c9.staticUrl);
        };
        
        /*
         * JavaScript Linkify - v0.3 - 6/27/2009
         * http://benalman.com/projects/javascript-linkify/
         *
         * Copyright (c) 2009 "Cowboy" Ben Alman
         * Dual licensed under the MIT and GPL licenses.
         * http://benalman.com/about/license/
         *
         * Some regexps adapted from http://userscripts.org/scripts/review/7122
         */
        plugin.linkify = function(){var k="[a-z\\d.-]+://",h="(?:(?:[0-9]|[1-9]\\d|1\\d{2}|2[0-4]\\d|25[0-5])\\.){3}(?:[0-9]|[1-9]\\d|1\\d{2}|2[0-4]\\d|25[0-5])",c="(?:(?:[^\\s!@#$%^&*()_=+[\\]{}\\\\|;:'\",.<>/?]+)\\.)+",n="(?:ac|ad|aero|ae|af|ag|ai|al|am|an|ao|aq|arpa|ar|asia|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|biz|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|cat|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|coop|com|co|cr|cu|cv|cx|cy|cz|de|dj|dk|dm|do|dz|ec|edu|ee|eg|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gov|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|info|int|in|io|iq|ir|is|it|je|jm|jobs|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mil|mk|ml|mm|mn|mobi|mo|mp|mq|mr|ms|mt|museum|mu|mv|mw|mx|my|mz|name|na|nc|net|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|org|pa|pe|pf|pg|ph|pk|pl|pm|pn|pro|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|sk|sl|sm|sn|so|sr|st|su|sv|sy|sz|tc|td|tel|tf|tg|th|tj|tk|tl|tm|tn|to|tp|travel|tr|tt|tv|tw|tz|ua|ug|uk|um|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|xn--0zwm56d|xn--11b5bs3a9aj6g|xn--80akhbyknj4f|xn--9t4b11yi5a|xn--deba0ad|xn--g6w251d|xn--hgbk6aj7f53bba|xn--hlcj6aya9esc7a|xn--jxalpdlp|xn--kgbechtv|xn--zckzah|ye|yt|yu|za|zm|zw)",f="(?:"+c+n+"|"+h+")",o="(?:[;/][^#?<>\\s]*)?",e="(?:\\?[^#<>\\s]*)?(?:#[^<>\\s]*)?",d="\\b"+k+"[^<>\\s]+",a="\\b"+f+o+e+"(?!\\w)",m="mailto:",j="(?:"+m+")?[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@"+f+e+"(?!\\w)",l=new RegExp("(?:"+d+"|"+a+"|"+j+")","ig"),g=new RegExp("^"+k,"i"),b={"'":"`",">":"<",")":"(","]":"[","}":"{","B;":"B+","b:":"b9"},i={callback:function(q,p){return p?'<a href="'+p+'" title="'+p+'">'+q+"</a>":q},punct_regexp:/(?:[!?.,:;'"]|(?:&|&amp;)(?:lt|gt|quot|apos|raquo|laquo|rsaquo|lsaquo);)$/};return function(u,z){z=z||{};var w,v,A,p,x="",t=[],s,E,C,y,q,D,B,r;for(v in i){if(z[v]===undefined){z[v]=i[v]}}while(w=l.exec(u)){A=w[0];E=l.lastIndex;C=E-A.length;if(/[\/:]/.test(u.charAt(C-1))){continue}do{y=A;r=A.substr(-1);B=b[r];if(B){q=A.match(new RegExp("\\"+B+"(?!$)","g"));D=A.match(new RegExp("\\"+r,"g"));if((q?q.length:0)<(D?D.length:0)){A=A.substr(0,A.length-1);E--}}if(z.punct_regexp){A=A.replace(z.punct_regexp,function(F){E-=F.length;return""})}}while(A.length&&A!==y);p=A;if(!g.test(p)){p=(p.indexOf("@")!==-1?(!p.indexOf(m)?"":m):!p.indexOf("irc.")?"irc://":!p.indexOf("ftp.")?"ftp://":"http://")+p}if(s!=C){t.push([u.slice(s,C)]);s=E}t.push([A,p])}t.push([u.substr(s)]);for(v=0;v<t.length;v++){x+=z.callback.apply(window,t[v])}return x||u}}();
        
        plugin.stableStringify = function(obj, replacer, spaces) {
            var sortByKeys = function(obj) {
                if (!obj || typeof obj != "object" || Array.isArray(obj)) {
                    return obj;
                }
                var sorted = {};
                Object.keys(obj).sort().forEach(function(key) {
                    sorted[key] = sortByKeys(obj[key]);
                });
                // assert(_.isEqual(obj, sorted));
                return sorted;
            };
            return JSON.stringify(sortByKeys(obj), replacer, spaces);
        };
        
        plugin.safeParseJson = function(strJson, cb){
            // Remove comments
            var data = strJson.replace(/(^|\n)\s*\/\/.*/g, "");
                
            try { return JSON.parse(data); }
            catch (e) { cb(e); return false; }
        }
        
        /**
         * 
         */
        plugin.extend = function(dest, src) {
            var prop, i, x = !dest.notNull;
            if (arguments.length == 2) {
                for (prop in src) {
                    if (x || src[prop])
                        dest[prop] = src[prop];
                }
                return dest;
            }
    
            for (i = 1; i < arguments.length; i++) {
                src = arguments[i];
                for (prop in src) {
                    if (x || src[prop])
                        dest[prop] = src[prop];
                }
            }
            return dest;
        };
        
        plugin.isEqual = function(o1, o2) {
            for (var prop in o1)
                if (o1[prop] != o2[prop])
                    return false;
            
            for (var prop in o2)
                if (o1[prop] != o2[prop])
                    return false;
        
            return true;
        };
        
        /**
         * Generate an XML tag that contains properties according to a property-map defined
         * in `attrs`.
         *
         * @param {String} tag Name of the XML tag
         * @param {Object} attrs Map of name-value pairs of XML properties
         * @param {Boolean} noclose If TRUE, the XML tag will be returned UNclosed. Defaults to FALSE.
         * @type {String}
         */
        plugin.toXmlTag = function (tag, attrs, noclose) {
            return "<" + tag + " " + plugin.toXmlAttributes(attrs) + (noclose ? ">" : " />");
        };
        
        /**
         * Returns the gravatar url for this user
         * @param {Number} size the size of the image
         */
        plugin.getGravatarUrl = function getGravatarUrl(email, size, defaultImage) {
            var md5Email = apf.crypto.MD5.hex_md5((email || "").trim().toLowerCase());
            return "https://secure.gravatar.com/avatar/" 
                + md5Email + "?s=" + size + "&d="  + (defaultImage || "retro");
        };
        
        var reHome, reWorkspace, homeSub;
        plugin.$initPaths = function(home, workspaceDir) {
            reHome = new RegExp("^" + plugin.escapeRegExp(home) + "(/|/?$)");
            var wd = workspaceDir.replace(/\/?$/, "");
            reWorkspace = new RegExp("^" + plugin.escapeRegExp(wd) + "(/|/?$)");
            homeSub = "~/";
            if (home == workspaceDir) {
                reHome = new RegExp("^(" + plugin.escapeRegExp(home) + "|~)(/|/?$)");
                homeSub = "/";
                reWorkspace = null;
            } else if (reHome.test(workspaceDir)) {
                reWorkspace = new RegExp("^" +
                    plugin.escapeRegExp(workspaceDir.replace(reHome, "~/")) + "(/|/?$)"
                );
            } else if (reWorkspace.test(home)) {
                reHome = new RegExp("^(" + plugin.escapeRegExp(home) + "|~)(/|/?$)");
                homeSub = home.replace(reWorkspace, "/").replace(/\/?$/, "/");
                reWorkspace = null;
            }
        };
        plugin.$initPaths(c9.home || "/home/ubuntu", c9.workspaceDir || "/");
        
        plugin.normalizePath = function(path){
            if (!path) return "";
            if (reHome) {
                path = path.replace(reHome, homeSub);
                if (reWorkspace) {
                    path = path.replace(reWorkspace, "/");
                }
            }
            return normalize(path);
        };
        
        /**
         * Converts a map of name-value pairs to XML properties.
         *
         * @param {Object} obj Map of name-value pairs of XML properties
         * @type {String}
         */
        plugin.toXmlAttributes = function(obj) {
            var xml = Object.keys(obj)
                .map(function (k) {
                    return k + '="' + apf.escapeXML(obj[k]) + '"';
                })
                .join(" ");
        
            return xml;
        };
        
        plugin.shadeColor = function(base, factor) {
            var m = base.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (!m) {
                m = base.match(/(\w\w)(\w\w)(\w\w)/);
                if (!m) {
                    m = base.match(/(\w)(\w)(\w)/);
                    if (!m)
                        return base; // not a color
                    m = [0, m[1] + m[1], m[2] + m[2], m[3] + m[3]];
                }
                m = [0, parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
            }
            
            var R = m[1], G = m[2], B = m[3];
            
            return {
                isLight: (0.2126 * R + 0.7152 * G + 0.0722 * B) > 150,
                color: "rgb(" + parseInt(R * factor, 10) + ", " 
                    + parseInt(G * factor, 10) + ", " 
                    + parseInt(B * factor, 10) + ")"
            };
        };
        
        plugin.getBox = function(value, base) {
            if (!base) base = 0;
        
            if (value === null || (!parseInt(value, 10) && parseInt(value, 10) !== 0))
                return [0, 0, 0, 0];
        
            var x = String(value).split(/\s* \s*/);
            for (var i = 0; i < x.length; i++)
                x[i] = parseInt(x[i], 10) || 0;
            switch (x.length) {
                case 1:
                    x[1] = x[0];
                    x[2] = x[0];
                    x[3] = x[0];
                    break;
                case 2:
                    x[2] = x[0];
                    x[3] = x[1];
                    break;
                case 3:
                    x[3] = x[1];
                    break;
            }
        
            return x;
        };

        plugin.escapeShell = function(cmd) {
            var re = /([\#\&\;\`\|\*\?<>\^\(\)\[\]\{\}\$\,\x0A\xFF\' \"\\])/g;
            return cmd.replace(re, "\\$1");//.replace(/^~/, "\\~");
        };
        
        var cloneObject = plugin.cloneObject = function(obj, shallow) {
            if (obj === null || typeof obj !== "object")
                return obj;
            var copy = Array.isArray(obj) ? [] : {};
            Object.keys(obj).forEach(function(k) {
                copy[k] = shallow ? obj[k] : cloneObject(obj[k]);
            });
            return copy;
        };

        plugin.nextFrame = window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            window.oRequestAnimationFrame;
        
        if (plugin.nextFrame)
            plugin.nextFrame = plugin.nextFrame.bind(window);
        else
            plugin.nextFrame = function(callback) {
                setTimeout(callback, 17);
            };
        
        plugin.freezePublicAPI({});
        
        register(null, {
            util: plugin
        });
    }
});