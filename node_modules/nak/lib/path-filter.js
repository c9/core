function PathFilter(inclusions, exclusions, showHidden) {
  if (!Array.isArray(inclusions)) {
    this.inclusionRe = inclusions || /^/;
    this.exclusionRe = exclusions || /^/;
    return;
  }
    
  var pos = [], neg = [];
  if (showHidden !== true)
    neg.push(".*");
  var hasDirectoryMatcher = false;
  var hasFileMatcher = false;
  inclusions.forEach(function(p) {
    p = p.trim(); // TODO this isn't gitignore compatible
    if (!p || p[0] === "#") 
      return;
      
    if (/\/\*?$/.test(p) || !/[.*]/.test(p)) {
      hasDirectoryMatcher = true;
      p = p.replace(/\/\*?$/, "");
      pos.push(p, p + "/*");
    } else {
      hasFileMatcher = true;
      pos.push(p);
    }
  });
  if (pos.length) {
    if (!hasDirectoryMatcher)
      pos.push("/");
  }
    
  exclusions.forEach(function(p) {
    p = p.trim();
    if (!p || p[0] === "#")
      return;
    neg.push(p);
  });
  
  var inc = this.createMatcherRe(pos);
  var exc = this.createMatcherRe(neg);
  
  if (!inc && !exc) {
    this.isPathAccepted = function(filepath) { return true; };
  } if (!inc && exc && !exc.hasNegative) {
    var re = exc.re;
    this.isPathAccepted = function(filepath) {
      return !re.test(filepath);
    };
  } else if (!inc && exc && exc.hasNegative) {
    var re1 = exc.re;
    this.isPathAccepted = function(filepath) {
      var m = re1.exec(filepath);
      return !(m && m[0]);
    };
  } else if (inc && exc) {
    var excRe = exc.re, incRe = inc.re;
    this.isPathAccepted = function(filepath) {
      var m = excRe.exec(filepath);
      if (m && m[0]) return false;
      m = incRe.exec(filepath);
      return !!(m && m[0]);
    };
  }
  
  this.inclusionRe = inc && inc.re || /^/;
  this.exclusionRe = exc && exc.re || /^/;
}

PathFilter.prototype.isPathAccepted = function(filepath) {
  return !this.exclusionRe.test(filepath) ||  this.inclusionRe.test(filepath);
};

PathFilter.prototype.createMatcherRe = function(patterns) {
  var source = "";
  var hasNegative = false;
  source = patterns.map(function(p) {
    var contents = p;
    var isNegated = p[0] === "!";
    if (isNegated) {
      contents = contents.slice(1);
      hasNegative = true;
    }  
    var reg = contents.replace(/(\\.)|(\*{1,2})|(\+)|([\/'*+?|()\[\]{}.\^$])/g, function(_, esc, star, plus, reg) {
      if (esc)
        return esc[1];
      if (plus)
        return ".+";
      if (star)
        return star[1] ? ".*?" : "[^\\/]*";
      if (reg)
        return "\\" + reg;
    });
    
    if (reg[1] !== "/")
      reg = "\\/" + reg;
    
    if (reg[reg.length - 1] === "\\")
      reg = reg.slice(0, -1);
    else if (reg[reg.length - 1] !== "/")
      reg += "\\/?";
      
    if (isNegated)
      reg = "(?=" + reg + "$)";
    else
      reg = "(?:" + reg + "$)";
      
    return reg;
  }).filter(Boolean).join("|");
  
  if (!source)
    return;

  return {
    re: new RegExp(source, ""),
    hasNegative: hasNegative
  };
};


PathFilter.escapeRegExp = function(str) {
  return str.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1');
};

module.exports = PathFilter;
