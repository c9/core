"use strict";

module.exports = function isZuoraId(value){
    if (/^\d+$/.test(value)) 
        return false;

    return /^[a-z0-9]{32}$/.test(value);
};