if (typeof define === "undefined") {		
    var define = function(fn) {		
        fn(require, exports, module);		
    };		
}

define(function(require, exports, module) {
    "use strict";

    function formatUser(user) {
        if (!user) return {}; // empty traits get ignored
        
        var uid = /^\d+$/.test(user.id) ? user.id : user.uid;
    
         var traits = {
                uid: uid,
                username: user.name || user.username,
                email: user.email,
                createdAt: user.date_add,
                active: !!user.active,
                firstName: getFirstName(user),
                lastName: getLastName(user),
                name: user.fullname || user.name,
                pricingPlan: user.premium ? "Premium" : "Free",
                referredBy: user.referrer,
                region: user.region,
                usertype: user.usertype,
                purpose: user.purpose,
            };

        return traits;
    }

    function getFirstName(user){
        if (user.firstname) return user.firstname;
        
        if (!user.fullname) return undefined;
       
        return user.fullname.split(' ').slice(0, 1).join(' ');
    }

    function getLastName(user){
        if (user.lastname) return user.lastname;
        
        if (!user.fullname) return undefined;
       
        return user.fullname.split(' ').slice(1).join(' ');
    }

    module.exports = formatUser;
});