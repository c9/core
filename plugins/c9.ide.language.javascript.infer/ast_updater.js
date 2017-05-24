define(function(require, exports, module) {

    var infer = require("./infer");
    var assert = require("c9/assert");
    var tree = require("treehugger/tree");
    
    /**
     * A regex determining if it is likely
     * possible to update the old AST, if it's diff matches this.
     * Note that a more expensive, AST-based check is performed
     * after this.
     */
    var REGEX_SAFE_CHANGE = /^[\(\)\s\.\/\*+;,A-Za-z-0-9_$]*$/;
    
    var lastAST;
    var lastDocValue;
   
    /**
     * Attempts to reuse & update the previously analyzed AST,
     * or re-analyzes as needed, using infer.update().
     * 
     * @param callback
     * @param callback.ast The analyzed AST to use.
     */
    module.exports.updateOrReanalyze = function(doc, ast, filePath, basePath, pos, callback) {
        // Try with our last adapted AST
        var docValue = doc.getValue();
        var updatedAST = tryUpdateAST(doc, docValue, ast);
        if (updatedAST) {
            if (ast.getAnnotation("scope")) {
                lastDocValue = docValue;
                lastAST = updatedAST;
            }
            // console.log("[ast_updater] reused AST"); // DEBUG
            return callback(updatedAST, findNode(updatedAST, pos));
        }
        
        // Re-analyze instead
        var start = new Date().getTime();
        return infer.analyze(doc, ast, filePath, basePath, function() {
            // console.log("[ast_updater] Reanalyzed in " + (new Date().getTime() - start) + "ms"); // DEBUG
            lastDocValue = docValue;
            lastAST = ast;
            callback(ast, findNode(ast, pos));
        }, true);
    };
   
    function tryUpdateAST(doc, docValue, ast) {
        if (lastAST && (!lastAST.annos || !lastAST.annos.scope)) {
            console.error("Warning: Source does not appear to be analyzed yet; restarting analysis");
            return false;
        }
        if (lastDocValue === docValue) {
            // Note: if this message appears when it shouldn't, something is
            // wrong with the mirror (mirror.js)
            // console.log("[ast_updater] Doc appears unchanged; reusing analysis");
            return lastAST;
        }
        if (!isUpdateableAST(doc, docValue, ast))
            return null;
        
        if (!copyAnnosTop(lastAST, ast, true))
            return null;
        copyAnnosTop(lastAST, ast);
        assert(ast.annos.scope, "Target is empty");
        return ast;
    }
    
    /**
     * Performs a simple, performant check to see if the
     * input is eligle for reusing the previous analysis.
     *
     * @returns {Boolean} true if the old AST may be reusable
     */
    function isUpdateableAST(doc, docValue, ast) {
        if (!lastDocValue)
            return false;

        var diff = getDiff(lastDocValue, docValue) || getDiff(docValue, lastDocValue);
        
        return diff && diff.text.match(REGEX_SAFE_CHANGE);
    }
    
    function copyAnnosTop(oldAST, newAST, dryRun) {
        if (!dryRun) copyAnnos(oldAST, newAST);
            
        for (var i = 0, j = 0; j < newAST.length; i++, j++) {
            if (!oldAST[i]) {
                if (newAST[j].cons !== "Var")
                    return false;
                // Var(x) was just inserted
                copyAnnos(findScopeNode(oldAST), newAST[j]);
                if (!newAST[j].annos)
                    return false;
                continue;
            }
            if (oldAST[i].cons !== newAST[j].cons) {
                // Var(x) became PropAccess(Var(x), y)
                if (oldAST[i].cons === "Var" && newAST[j].isMatch("PropAccess(Var(_),_)")) {
                    copyAnnos(oldAST[i], newAST[j][0]);
                    continue;
                }
                // PropAccess(Var(x), y) became Var(x)
                if (newAST[j].cons === "Var" && oldAST[i].isMatch("PropAccess(Var(_),_)")) {
                    copyAnnos(oldAST[i][0], newAST[j]);
                    continue;
                }
                // PropAccess became Call(PropAccess, _)
                if (oldAST[i].isMatch("PropAccess(Var(_),_)") && newAST[j].isMatch("Call(PropAccess(Var(_),_),_)")) {
                    copyAnnos(oldAST[i][0], newAST[j][0][0]);
                    var oldTemplate = new tree.ListNode([oldAST[i][0]]);
                    oldTemplate.parent = oldAST;
                    copyAnnosTop(oldTemplate, newAST[j][1], dryRun);
                    continue;
                }
                // Call(PropAccess, _) became PropAccess
                if (newAST[j].isMatch("PropAccess(Var(_),_)") && oldAST[i].isMatch("Call(PropAccess(Var(_),_),_)")) {
                    copyAnnos(oldAST[i][0][0], newAST[j][0]);
                    continue;
                }
                // Var(x) was (possibly) inserted
                if (newAST[j].cons === "Var" && newAST[j + 1] && newAST[j + 1].cons === oldAST[i].cons) {
                    copyAnnos(findScopeNode(oldAST), newAST[j]);
                    if (!newAST[j].annos)
                        return false;
                    i--;
                    continue;
                }
                // Var(x) was (possibly) added
                if (oldAST[i].cons === "None" && newAST[j].cons === "Var") {
                    copyAnnos(findScopeNode(oldAST), newAST[j]);
                    if (!newAST[j].annos)
                        return false;
                    i--;
                    continue;
                }
                // Var(x) was (possibly) removed
                if (oldAST[i].cons === "Var" && oldAST[i + 1] && oldAST[i + 1].cons === newAST[i].cons) {
                    j--;
                    continue;
                }
                // [stm1, stm2] became [If(Stm1), stm2] or [If(stm2)]
                if (["If", "Return", "Throw"].indexOf(newAST[j].cons) > -1 && (!newAST[j][1] || newAST[j][1].isMatch("Block([])"))) {
                    var cond = newAST[j][0].toString();
                    if (cond === oldAST[i].toString()) {
                        copyAnnos(oldAST[i], newAST[j][0]);
                        continue;
                    }
                    else if (!oldAST[i + 1]) {
                        continue;
                    }
                    else if (cond === oldAST[i + 1].toString()) {
                        i++;
                        copyAnnos(oldAST[i], newAST[j][0]);
                        continue;
                    }
                }
                // "if () s" became "if (c) s"
                if (oldAST.cons === "If" && newAST.cons === "If" && newAST[0].cons === "Var" && oldAST[1].isMatch("Block([])")) {
                    var oldCond = oldAST[0];
                    var newCond = newAST[0];
                    var newBody = newAST[1];
                    if (oldCond.toString() === newBody.toString()) {
                        copyAnnos(findScopeNode(oldAST), newCond);
                        if (!newCond.annos)
                            return false;
                        copyAnnos(oldCond, newBody);
                        continue;
                    }
                }
                return false;
            }
            if (newAST[j].length) {
                if (!copyAnnosTop(oldAST[i], newAST[j], dryRun))
                    return false;
            } else if (!dryRun && newAST[j].$pos) {
                copyAnnos(oldAST[i], newAST[j]);
            }
            
        }
        return true;
    }
    
    function copyAnnos(oldNode, newNode) {
        newNode.oldNode = oldNode.oldNode || oldNode;
        newNode.oldNode.$pos = newNode.$pos;
        
        if (!oldNode.annos)
            return;
        newNode.annos = oldNode.annos;
    }
    
    function findScopeNode(ast) {
        if (!ast)
            return null;
        if (ast.annos && ast.annos.scope)
            return ast;
        return findScopeNode(ast.parent);
    }
    
    function getDiff(oldDoc, newDoc) {
        if (oldDoc.length > newDoc.length)
            return null;
        
        var diffLeft = -1;
        var diffRight = 0;
        
        for (var i = 0; i < newDoc.length; i++) {
            if (oldDoc[i] !== newDoc[i]) {
                diffLeft = i;
                break;
            }
        }
        
        for (var i = newDoc.length, j = oldDoc.length; j >= 0; i--, j--) {
            if (oldDoc[j] !== newDoc[i]) {
                diffRight = i + 1;
                break;
            }
        }
        
        assert(diffLeft != -1, "Inputs can't be equal");
        
        return {
            start: diffLeft,
            end: diffRight,
            text: newDoc.substring(diffLeft, diffRight)
        };
    }
    
    function findNode(ast, pos) {
        var treePos = { line: pos.row, col: pos.column };
        return ast.findNode(treePos);
    }
    
    
});
