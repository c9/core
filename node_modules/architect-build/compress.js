var UglifyJS = require("uglify-js");


function compress(sources, opts) {
    if (!opts)
        opts = {};
    if (typeof sources == "string")
        sources = [{source: sources, file: ""}];
    
    var toplevel = null;
    var literals = [];
    
    sources.forEach(function(pkg){
        if (/^"disable compress"/.test(pkg.source))
            return literals.push(pkg.source);
        
        if (pkg.file) console.log("Adding '" + pkg.file + "'.");
        
        toplevel = UglifyJS.parse(pkg.source, {
            filename: (pkg.file || pkg.id).replace(new RegExp("^" + opts.basepath + "/"), ""), //@todo remove prefix
            toplevel: toplevel
        });
    });
    
    if (!toplevel) {
        return { code: literals.join("\n"), map: null };
    }
    
    /**
     * UglifyJS contains a scope analyzer that you need to call manually before 
     * compressing or mangling. Basically it augments various nodes in the AST 
     * with information about where is a name defined, how many times is a name 
     * referenced, if it is a global or not, if a function is using eval or the 
     * with statement etc. I will discuss this some place else, for now what's 
     * important to know is that you need to call the following before doing 
     * anything with the tree:
     */
    toplevel.figure_out_scope();
    
    var compressor = UglifyJS.Compressor({
        warnings: !!opts.verbose,
        unsafe: false
    });
    var compressed_ast = toplevel.transform(compressor);
    
    /**
     * After compression it is a good idea to call again figure_out_scope 
     * (since the compressor might drop unused variables / unreachable code and 
     * this might change the number of identifiers or their position). 
     * Optionally, you can call a trick that helps after Gzip (counting 
     * character frequency in non-mangleable words). 
     */
    compressed_ast.figure_out_scope();
    compressed_ast.compute_char_frequency();

    // Right now this breaks the LogicBlox workspace; needs further investigation
    if (opts.obfuscate) {
        compressed_ast.mangle_names({except: ["$", "require", "exports", "initBaseUrls", "initSender"]});
    }
    
    var outputOptions = opts.oneLine ? {} : {
        quote_keys    : false, // quote all keys in object literals?
        space_colon   : false, // add a space after colon signs?
        ascii_only    : false, // output ASCII-safe? (encodes Unicode characters as ASCII)
        inline_script : false, // escape "</script"?
        max_line_len  : 100,   // maximum line length (for non-beautified output)
        beautify      : false, // beautify output?
        bracketize    : false, // use brackets every time?
        comments      : false, // output comments?
        semicolons    : false  // use semicolons to separate statements? (otherwise, newlines)
    };

    if (opts.mapFile) {
        // Generate a source map
        var source_map = UglifyJS.SourceMap({
            file : opts.mapFile || "build.js.map",
            root : opts.mapRoot
        });
        outputOptions.source_map = source_map;
    }
    var stream = UglifyJS.OutputStream(outputOptions);
    compressed_ast.print(stream);
    
    function asciify(text) {
        // remove top level use strict since that can break some librarires
        text = text.replace(/^(["'])use strict\1/, "$1no strict!$1");
        text = text.replace(/[\x80-\uffff]/g, function(c) {
            c = c.charCodeAt(0).toString(16);
            if (c.length == 2)
                return "\\x" + c;
            if (c.length == 3)
                c = "0" + c;
            return "\\u" + c;
        });
        return text;
    }
    
    return {
        code : asciify(stream.toString()) + "\n" + literals.join("\n"),
        map  : source_map ? source_map.toString() : null // json output for your source map
    };
}

compress.withCache = function(sources, opts) {
    var cache = opts.cache;
    if (cache && !cache.compress)
        cache.compress = Object.create(null);
    var code = sources.map(function(pkg) {
        if (pkg.id && cache.compress[pkg.id]) {
            console.log("Compress Cache Hit" + pkg.id);
            return cache.compress[pkg.id];
        }
        if (opts.exclude && opts.exclude.test(pkg.id))
            return pkg.source;
        var code = compress([pkg], opts).code;
        if (/[([]/.test(code[0]))
            code = ";" + code;
        return (cache.compress[pkg.id] = code);
    }).join("\n");
    return {code: code, map: null};
};

module.exports = compress;


// console.log(compress([{source: "/*disable compress*/var a = 0; var  b = 1+1;"}, {source: "var a = 0; var  b = 1+1;"} ]))