define(function(require, exports, module) {
    main.consumes = ["Plugin"];
    main.provides = ["collab.util"];
    return main;

    function main(options, imports, register) {
        var Plugin = imports.Plugin;
        var plugin = new Plugin("Ajax.org", main.consumes);

        var HTML_ENTITY_MAP = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };

        // Copied from npm security@1.0.0
        // OSWASP Guidlines: &, <, >, ", ' plus forward slash.
        var HTML_CHARACTERS_EXPRESSION = /[&"'<>\/]/gm;
        function escapeHTML(text) {
          return text && text.replace(HTML_CHARACTERS_EXPRESSION, function (c) {
            return HTML_ENTITY_MAP[c] || c;
          });
        }

        // Copied from npm security@1.0.0
        // OSWASP Guidlines: escape all non alphanumeric characters in ASCII space.
        var HTML_ATTRIBUTE_CHARACTERS_EXPRESSION =
            /[\x00-\x2F\x3A-\x40\x5B-\x60\x7B-\xFF]/gm;
        function escapeHTMLAttribute(text) {
          return text && text.replace(HTML_ATTRIBUTE_CHARACTERS_EXPRESSION, function (c) {
            return HTML_ENTITY_MAP[c] || "&#x" + ('00' + c.charCodeAt(0).toString(16)).slice(-2) + ";";
          });
        }

        function findURLs(text) {
            // copied from ACE
            var _REGEX_WORDCHAR = /[\u0030-\u0039\u0041-\u005A\u0061-\u007A\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\u1FFF\u3040-\u9FFF\uF900-\uFDFF\uFE70-\uFEFE\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFDC]/;
            var _REGEX_URLCHAR = new RegExp('(' + /[-:@a-zA-Z0-9_.,~%+\/?=&#;()$]/.source + '|' + _REGEX_WORDCHAR.source + ')');
            var _REGEX_URL = new RegExp(/(?:(?:https?|s?ftp|ftps|file|smb|afp|nfs|(x-)?man|gopher|txmt):\/\/|mailto:)/.source + _REGEX_URLCHAR.source + '*(?![:.,;])' + _REGEX_URLCHAR.source, 'g');

            // returns null if no URLs, or [[startIndex1, url1], [startIndex2, url2], ...]
            function _findURLs(text) {
                _REGEX_URL.lastIndex = 0;
                var urls = null;
                var execResult;
                while ((execResult = _REGEX_URL.exec(text))) {
                    urls = (urls || []);
                    var startIndex = execResult.index;
                    var url = execResult[0];
                    urls.push([startIndex, url]);
                }
                return urls;
            }
            return _findURLs(text);
        }

        function escapeHtmlWithClickableLinks(text, target) {
            var idx = 0;
            var pieces = [];
            var urls = findURLs(text);

            function advanceTo(i) {
                if (i > idx) {
                    pieces.push(escapeHTML(text.substring(idx, i)));
                    idx = i;
                }
            }
            if (urls) {
                for (var j = 0; j < urls.length; j++) {
                    var startIndex = urls[j][0];
                    var href = urls[j][1];
                    advanceTo(startIndex);
                    pieces.push('<a ', (target ? 'target="' + escapeHTMLAttribute(target) + '" ' : ''), 'href="', escapeHTMLAttribute(href), '">');
                    advanceTo(startIndex + href.length);
                    pieces.push('</a>');
                }
            }
            advanceTo(text.length);
            return pieces.join('');
        }

        function formatColor(rgb, alpha) {
            if (!rgb)
                return "transparent";
            if (alpha)
                return ["rgba(", rgb.r, ",", rgb.g, ",", rgb.b, ",", alpha, ")"].join("");
            else
                return ["rgb(", rgb.r, ",", rgb.g, ",", rgb.b, ")"].join("");
        }

        function reverseObject(obj) {
            var reversed = {};
            for (var auth in obj)
                reversed[obj[auth]] = auth;
            return reversed;
        }

        function isRealCollab(workspace) {
            var users = workspace.users;
            var numUsers = Object.keys(users).length;
            if (users["Anonymous"])
                numUsers--;
            return numUsers > 1;
        }
        
        function normalizeTextLT(text) {
            return text.replace(/\r\n?/g, "\n");
        }

        function detectNewLineType(text) {
            // Must be the strictly same as on the client
            var match = text.match(/^.*?(\r\n|\r|\n)/m);
            return match ? match[1] : "\n";
        }

        /**
         * Utilities for the collab plugins
         */
        plugin.freezePublicAPI({
            detectNewLineType: detectNewLineType,
            normalizeTextLT: normalizeTextLT,
            /**
             * Escape text from HTML tags and format hyperlinks to HTML anchor elements
             * @param {String} text - the text to escape HTML from
             * @param {String} target - optional - the target of the added anchor element
             */
            escapeHtmlWithClickableLinks: escapeHtmlWithClickableLinks,
            /**
             * Escape text from HTML tags
             * @param {String} text - the text to escape HTML from
             */
            escapeHTML: escapeHTML,
            /**
             * Format a color
             * @param {Object} color descripted as an object with attributes for red, green and blue : {r: 111, g: 20, b: 255}
             * @param {Number} alpha  - optional - the alpha transparency of the color
             */
            formatColor: formatColor,
            /**
             * Reverse object keys to values with corresponding values as thier keys
             * @param obj
             */
            reverseObject: reverseObject,
            /**
             * Check the collab workspace if collab is really enabled with more than one user active
             * @param {Workspace} workspace
             */
            isRealCollab: isRealCollab
        });
        
        register(null, {
            "collab.util": plugin
        });
    }
});
