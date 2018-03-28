
// These users don't have backups made of their workspaces and if they are supposed to be archived they are deleted instead. 
var CI_TEMP_USERS = [
    733399, // branches
]

var ciHelper = {
    isTempUser: function (userId) {
        return CI_TEMP_USERS.indexOf(userId) >= 0;
    }
    
}

module.exports = ciHelper;