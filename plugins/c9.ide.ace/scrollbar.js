define(function(require, exports, module) {
var dom = require("ace/lib/dom");

if (!dom.scrollbarWidth(document)) 
    return;
dom.importCssString("\
::-webkit-scrollbar {\
   background: none;\
   width: 16px;\
   height: 16px;\
}\
::-webkit-scrollbar-thumb {\
    border: solid 0 rgba(0, 0, 0, 0);\
    border-right-width: 4px;\
    border-left-width: 4px;\
    -webkit-border-radius: 9px 4px;\
    -webkit-box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.2), inset 0 0 0 4px rgba(128, 128, 128, 0.2);\
}\
::-webkit-scrollbar-track-piece {\
    margin: 4px 0;\
}\
::-webkit-scrollbar-thumb:horizontal {\
    border-right-width: 0;\
    border-left-width: 0;\
    border-top-width: 4px;\
    border-bottom-width: 4px;\
    -webkit-border-radius: 4px 9px;\
}\
::-webkit-scrollbar-thumb:hover {\
    -webkit-box-shadow:\
      inset 0 0 0 1px rgba(128,128,128,0.9),\
      inset 0 0 0 4px rgba(128,128,128,0.9);\
}\
::-webkit-scrollbar-corner {\
    background: transparent;\
}\
.ace_scrollbar-h{margin: 0 2px}\
");
});