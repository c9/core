define(function(require, exports, module) {

function inRange(p, pos, exclusive) {
    if(p && p.sl <= pos.line && pos.line <= p.el) {
        if(p.sl < pos.line && pos.line < p.el)
            return true;
        else if(p.sl == pos.line && pos.line < p.el)
            return p.sc <= pos.col;
        else if(p.sl == pos.line && p.el === pos.line)
            return p.sc <= pos.col && pos.col <= p.ec + (exclusive ? 1 : 0);
        else if(p.sl < pos.line && p.el === pos.line)
            return pos.col <= p.ec + (exclusive ? 1 : 0);
    }
}

/**
 * Base 'class' of every tree node
 */
function Node() {
}

Node.prototype.toPrettyString = function(prefix) {
    prefix = prefix || "";
    return prefix + this.toString();
};

Node.prototype.setAnnotation = function(name, value) {
    this.annos = this.annos || {};
    this.annos[name] = value;
};

Node.prototype.getAnnotation = function(name) {
    return this.annos ? this.annos[name] : undefined;
};

Node.prototype.$pos = null;
Node.prototype.getPos = function() {
    if(this.annos && this.annos.pos) {
        return this.annos.pos;
    } else {
        var p = this.$pos;
        return p && {
            sl : p.start.line, sc : p.start.column,
            el : p.end.line, ec : p.end.column
        };
    }
};

Node.prototype.findNode = function(pos) {
    var p = this.getPos();
    if(inRange(p, pos)) {
        return this;
    } else {
        return null;
    }
};

/**
 * Represents a constructor node
 * 
 * Example: Add(Num("1"), Num("2")) is constucted
 *    using new ConsNode(new ConsNode("Num", [new StringNode("1")]),
 *                                         new ConsNode("Num", [new StringNode("2")]))
 *    or, more briefly:
 *        tree.cons("Add", [tree.cons("Num", [ast.string("1"), ast.string("2")])])
 */
function ConsNode(cons, children) {
    this.cons = cons;
    for(var i = 0; i < children.length; i++) {
        this[i] = children[i];
    }
    this.length = children.length;
}

ConsNode.prototype = new Node();

/**
 * Simple human-readable string representation (no indentation)
 */
ConsNode.prototype.toString = function(prefix) {
    try {
        var s = this.cons + "(";
        for ( var i = 0; i < this.length; i++) {
            s += this[i].toString() + ",";
        }
        if (this.length > 0) {
            s = s.substring(0, s.length - 1);
        }
        return s + ")";
    } catch(e) {
        console.error("Something went wrong: ", this, e);
    }
};

/**
 * Human-readable string representation (indentented)
 * @param prefix is for internal use
 */
ConsNode.prototype.toPrettyString = function(prefix) {
    prefix = prefix || "";
    try {
        if(this.length === 0) {
            return prefix + this.cons + "()";
        }
        if(this.length === 1 && (this[0] instanceof StringNode || this[0] instanceof NumNode)) {
            return prefix + this.cons + "(" + this[0].toString() + ")";
        }
        var s = prefix + this.cons + "(\n";
        for ( var i = 0; i < this.length; i++) {
            s += this[i].toPrettyString(prefix + "    ") + ",\n";
        }
        s = s.substring(0, s.length - 2);
        s += "\n";
        return s + prefix + ")";
    } catch(e) {
        console.error("Something went wrong: ", this, e);
    }
};

/**
 * Matches the current term against `t`, writing matching placeholder values to `matches`
 * @param t the node to match against
 * @param matches the object to write placeholder values to
 * @returns the `matches` object if it matches, false otherwise
 */
ConsNode.prototype.match = function(t, matches) {
    matches = matches || {};
    if (t instanceof ConsNode) {
        if (this.cons === t.cons) {
            if (this.length === t.length) {
                for ( var i = 0; i < this.length; i++) {
                    if (!this[i].match(t[i], matches)) {
                        return false;
                    }
                }
                return matches;
            }
        }
    }
    return false;
};

/**
 * Builds a node, based on values (similar to `matches` object),
 * replacing placeholder nodes with values from `values`
 * @returns resulting cons node
 */
ConsNode.prototype.build = function(values) {
    var children = [];
    for ( var i = 0; i < this.length; i++) {
        children.push(this[i].build(values));
    }
    return new ConsNode(this.cons, children);
};

/**
 * Prettier JSON representation of constructor node.
 */
ConsNode.prototype.toJSON = function() {
    var l = [];
    for(var i = 0; i < this.length; i++) {
        l.push(this[i]);
    }
    return {cons: this.cons, children: l};
};

ConsNode.prototype.getPos = function() {
    // Below is a pretty horribly convoluted way of getting a position,
    // which initially was to help reliability of uglify positions,
    // and now still helps with missing positions while maintaining
    // backward compatibility.
    if (this.$pos && this.$pos.start && this.$pos.end) {
        var p = this.$pos;
        return {sl : p.start.line, sc : p.start.column,
                el : p.end.line, ec : p.end.column};
    }

    var nodePos = this.getAnnotation("pos");
    var result = nodePos
        ? {sl : nodePos.sl, sc : nodePos.sc, el : nodePos.el, ec : nodePos.ec}
        : {sl : Number.MAX_VALUE, sc : Number.MAX_VALUE, el : 0, ec : 0};
    
    var hasSl = false;
    var hasSc = false;
    
    for (var i = 0; i < this.length; i++) {
        var p = this[i].getPos();

        if (p) {
            if (p.sl < Number.MAX_VALUE && !hasSl) {
                result.sl = p.sl;
                hasSl = true;
            }
            if (p.sc < Number.MAX_VALUE && !hasSc) {
                result.sc = p.sc;
                hasSc = true;
            }
            result.el = p.el || result.el;
            result.ec = p.ec || result.ec;
        }
    }
    
    return result;
};

ConsNode.prototype.$pos = null;

ConsNode.prototype.findNode = function(pos) {
    var p = this.getPos();

    if(inRange(p, pos)) {
        for(var i = 0; i < this.length; i++) {
            var p2 = this[i].getPos();
            if(inRange(p2, pos)) {
                var node = this[i].findNode(pos);
                if(node)
                    return node instanceof StringNode ? this : node;
                else
                    return this[i];
            }
        }
    } else {
        return null;
    }
};

/**
 * Constructor node factory.
 */
exports.cons = function(name, children) {
    return new ConsNode(name, children);
};

/**
 * AST node representing a list
 * e.g. for constructors with variable number of arguments, e.g. in
 *      Call(Var("alert"), [Num("10"), Num("11")])
 * 
 */
function ListNode (children) {
    for(var i = 0; i < children.length; i++)
        this[i] = children[i];
    this.length = children.length;
}

ListNode.prototype = new Node();

ListNode.prototype.toString = function() {
    var s = "[";
    for (var i = 0; i < this.length; i++)
        s += this[i].toString() + ",";
    if (this.length > 0)
        s = s.substring(0, s.length - 1);
    return s + "]";
};

ListNode.prototype.toPrettyString = function(prefix) {
    prefix = prefix || "";
    try {
        if(this.length === 0)
            return prefix + "[]";
        var s = prefix + "[\n";
        for ( var i = 0; i < this.length; i++)
            s += this[i].toPrettyString(prefix + "  ") + ",\n";
        s = s.substring(0, s.length - 2);
        s += "\n";
        return s + prefix + "]";
    } catch(e) {
        console.error("Something went wrong: ", this);
    }
};

ListNode.prototype.match = function(t, matches) {
    matches = matches || {};
    if (t instanceof ListNode) {
        if (this.length === t.length) {
            for ( var i = 0; i < this.length; i++)
                if (!this[i].match(t[i], matches))
                    return false;
            return matches;
        }
        else
            return false;
    }
    else
        return false;
};

ListNode.prototype.build = function(values) {
    var children = [];
    for (var i = 0; i < this.length; i++)
        children.push(this[i].build(values));
    return new ListNode(children);
};

ListNode.prototype.getPos = ConsNode.prototype.getPos;
ListNode.prototype.findNode = ConsNode.prototype.findNode;

/**
 * forEach implementation, similar to Array.prototype.forEach
 */
ListNode.prototype.forEach = function(fn) {
    for(var i = 0; i < this.length; i++) {
        fn.call(this[i], this[i], i);
    }
};

/**
 * Whether the list is empty (0 elements)
 */
ListNode.prototype.isEmpty = function() {
    return this.length === 0;
};

/**
 * Performs linear search, performing a match
 * with each element in the list
 * @param el the element to search for
 * @returns true if found, false if not
 */
ListNode.prototype.contains = function(el) {
    for(var i = 0; i < this.length; i++)
        if(el.match(this[i]))
            return true;
    return false;
};

/**
 * Concatenates list with another list, similar to Array.prototype.concat
 */
ListNode.prototype.concat = function(l) {
    var ar = [];
    for(var i = 0; i < this.length; i++)
        ar.push(this[i]);
    for(i = 0; i < l.length; i++)
        ar.push(l[i]);
    return exports.list(ar);
};

ListNode.prototype.toJSON = function() {
    var l = [];
    for(var i = 0; i < this.length; i++)
        l.push(this[i]);
    return l;
};

/**
 * Returns a new list node, with all duplicates removed
 * Note: cubic complexity algorithm used
 */
ListNode.prototype.removeDuplicates = function() {
    var newList = [];
    lbl: for(var i = 0; i < this.length; i++) {
        for(var j = 0; j < newList.length; j++)
            if(newList[j].match(this[i]))
                continue lbl;
        newList.push(this[i]);
    }
    return new exports.list(newList);
};

ListNode.prototype.toArray = ListNode.prototype.toJSON;

/**
 * ListNode factory
 */
exports.list = function(elements) {
    return new ListNode(elements);
};

function NumNode (value) {
    this.value = value;
}

NumNode.prototype = new Node();

NumNode.prototype.toString = function() {
    return ""+this.value;
};

NumNode.prototype.match = function(t, matches) {
    matches = matches || {};
    if (t instanceof NumNode)
        return this.value === t.value ? matches : false;
    else
        return false;
};

NumNode.prototype.build = function(values) {
    return this;
};

exports.num = function(value) {
    return new NumNode(value);
};

function StringNode (value) {
    this.value = value;
}

StringNode.prototype = new Node();

StringNode.prototype.toString = function() {
    return '"' + this.value + '"';
};

StringNode.prototype.match = function(t, matches) {
    matches = matches || {};
    if (t instanceof StringNode)
        return this.value === t.value ? matches : false;
    else
        return false;
};

StringNode.prototype.build = function(values) {
    return this;
};

exports.string = function(value) {
    return new StringNode(value);
};

function PlaceholderNode(id) {
    this.id = id;
}

PlaceholderNode.prototype = new Node();

PlaceholderNode.prototype.toString = function() {
    return this.id;
};

PlaceholderNode.prototype.match = function(t, matches) {
    matches = matches || {};
    if(this.id === '_')
        return matches;
    if(matches[this.id]) // already bound
        return matches[this.id].match(t);
    else {
        matches[this.id] = t;
        return matches;
    }
};

PlaceholderNode.prototype.build = function(values) {
    return values[this.id];
};

exports.placeholder = function(n) {
    return new PlaceholderNode(n);
};


function parse (s) {
    var idx = 0;
    function accept (str) {
        for ( var i = 0; i < str.length && idx + i < s.length; i++) {
            if (str[i] != s[idx + i]) {
                return false;
            }
        }
        return i == str.length;
    }
    function lookAheadLetter() {
        return s[idx] >= 'a' && s[idx] <= 'z' || s[idx] >= 'A' && s[idx] <= 'Z' || s[idx] === '_' || s[idx] >= '0' && s[idx] <= '9';
    }
    function skipWhitespace () {
        while (idx < s.length && (s[idx] === " " || s[idx] === "\n" || s[idx] === "\r" || s[idx] === "\t")) {
            idx++;
        }
    }
    function parseInt () {
        var pos = idx;
        if (s[idx] >= '0' && s[idx] <= '9') {
            var ns = s[idx];
            idx++;
            while (idx < s.length && s[idx] >= '0' && s[idx] <= '9') {
                ns += s[idx];
                idx++;
            }
            skipWhitespace();
            return new NumNode(+ns, pos);
        } else {
            return null;
        }
    }
    function parseString () {
        var pos = idx;
        if (accept('"')) {
            var ns = "";
            idx++;
            while (!accept('"') || (accept('"') && s[idx - 1] == '\\')) {
                ns += s[idx];
                idx++;
            }
            var ns2 = '';
            for ( var i = 0; i < ns.length; i++) {
                if (ns[i] == "\\") {
                    i++;
                    switch (ns[i]) {
                        case 'n':
                            ns2 += "\n";
                            break;
                        case 't':
                            ns2 += "\t";
                            break;
                        default:
                            ns2 += ns[i];
                    }
                } else {
                    ns2 += ns[i];
                }
            }
            idx++;
            skipWhitespace();
            return new StringNode(ns2, pos);
        } else {
          return null;
        }
    }
    function parsePlaceholder() {
        var pos = idx;
        if (lookAheadLetter() && s[idx].toLowerCase() === s[idx]) {
            var ns = "";
            while (lookAheadLetter() && idx < s.length) {
                ns += s[idx];
                idx++;
            }
            skipWhitespace();
            return new PlaceholderNode(ns, pos);
        }
        else {
            return null;
        }
    }
    function parseList() {
        var pos = idx;
        if (accept('[')) {
            var items = [];
            idx++;
            skipWhitespace();
            while (!accept(']') && idx < s.length) {
                items.push(parseExp());
                if (accept(',')) {
                    idx++; // skip comma
                    skipWhitespace();
                }
            }
            idx++;
            skipWhitespace();
            return new ListNode(items, pos);
        }
        else {
            return null;
        }
    }
    function parseCons () {
        var pos = idx;
        // assumption: it's an appl
        var ns = "";
        while (!accept('(')) {
            ns += s[idx];
            idx++;
        }
        idx++; // skip (
        var items = [];
        while (!accept(')') && idx < s.length) {
            items.push(parseExp());
            if (accept(',')) {
                idx++; // skip comma
                skipWhitespace();
            }
        }
        idx++;
        skipWhitespace();
        return new ConsNode(ns, items, pos);
    }

    function parseExp() {
        var r = parseInt();
        if (r) return r;
        r = parseString();
        if (r) return r;
        r = parseList();
        if (r) return r;
        r = parsePlaceholder();
        if (r) return r;
        return parseCons();
    }
    return parseExp();
}

var parseCache = {};
function parseCached (s) {
    if(typeof s !== 'string') {
        return null;
    }
    if(s.length > 200) {
        return parse();
    }
    return parseCache[s] || (parseCache[s] = parse(s));
}

exports.Node = Node;
exports.ConsNode = ConsNode;
exports.ListNode = ListNode;
exports.NumNode = NumNode;
exports.StringNode = StringNode;
exports.PlaceholderNode = PlaceholderNode;
exports.parse = parseCached;
exports.inRange = inRange;

});
