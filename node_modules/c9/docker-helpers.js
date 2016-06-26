
var dockerHelpers = {
    getContainerIdFromContainer: function (container) {
        var match = container.match(/^[a-f0-9]+/);
        return match && match[0];
    },
    
    getContainerNameFromContainer: function (container) {
        var match = container.replace(/[^0-9a-zA-Z]$/, "").match(/[0-9a-zA-Z_-]+$/);
        return match && match[0];
    },
    
    getUsernameFromContainerName: function (containerName)  {
        if (containerName.split("-").length < 3) return "";
        return containerName.replace(/^container-/, "")
            .replace(/-[a-zA-Z]+$/, "")
            .replace(/-[0-9]+$/, "")
            .split("-")[0];
    },
    
    getProjectNameFromContainerName: function (containerName) {
        if (containerName.split("-").length < 3) return "";
        return containerName.replace(/^container-/, "")
            .replace(/-[a-zA-Z]+$/, "")
            .replace(/-[0-9]+$/, "")
            .split("-")
            .splice(1)
            .join("-");
    },
    
    getProjectIdFromContainerName: function (containerName) {
        if (containerName.split("-").length < 3) return "";
        return containerName.replace(/^container-/, "")
            .replace(/-[a-zA-Z]+$/, "")
            .split("-")
            .splice(-1)
            .join("-");
    }
}

module.exports = dockerHelpers;