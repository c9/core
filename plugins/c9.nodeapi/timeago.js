define(function(require, exports, module) {

    function timeago(timestamp) {
        if (timestamp instanceof Date) {
            return inWords(timestamp);
        } else if (typeof timestamp === "string") {
            return inWords(parse(timestamp));
        } else if (typeof timestamp === "number") {
            return inWords(new Date(timestamp));
        } else {
            return timeagoElement(timestamp);
        }
    }

    var settings = {
        refreshMillis: 60000,
        allowFuture: false,
        strings: {
            prefixAgo: null,
            prefixFromNow: null,
            suffixAgo: "ago",
            suffixFromNow: "from now",
            seconds: "less than a minute",
            minute: "about a minute",
            minutes: "%d minutes",
            hour: "about an hour",
            hours: "about %d hours",
            day: "a day",
            days: "%d days",
            month: "about a month",
            months: "%d months",
            year: "about a year",
            years: "%d years",
            wordSeparator: " ",
            numbers: []
        }
    };
    function distanceInWords(distanceMillis) {
        var $l = settings.strings;
        var prefix = $l.prefixAgo;
        var suffix = $l.suffixAgo;
        if (settings.allowFuture) {
            if (distanceMillis < 0) {
                prefix = $l.prefixFromNow;
                suffix = $l.suffixFromNow;
            }
        }

        var seconds = Math.abs(distanceMillis) / 1000;
        var minutes = seconds / 60;
        var hours = minutes / 60;
        var days = hours / 24;
        var years = days / 365;

        function substitute(stringOrFunction, number) {
            var string = typeof stringOrFunction === "function" ? stringOrFunction(number, distanceMillis) : stringOrFunction;
            var value = ($l.numbers && $l.numbers[number]) || number;
            return string.replace(/%d/i, value);
        }

        var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
            seconds < 90 && substitute($l.minute, 1) ||
            minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
            minutes < 90 && substitute($l.hour, 1) ||
            hours < 24 && substitute($l.hours, Math.round(hours)) ||
            hours < 42 && substitute($l.day, 1) ||
            days < 30 && substitute($l.days, Math.round(days)) ||
            days < 45 && substitute($l.month, 1) ||
            days < 365 && substitute($l.months, Math.round(days / 30)) ||
            years < 1.5 && substitute($l.year, 1) ||
            substitute($l.years, Math.round(years));

        var separator = $l.wordSeparator || "";
        if ($l.wordSeparator === undefined) { separator = " "; }
        return [prefix, words, suffix].filter(function(s) { return s; })
            .map(function(s){ return s.trim(); })
            .join(separator);
    }
    function parse(iso8601) {
        var s = iso8601.trim();
        s = s.replace(/\.\d+/,""); // remove milliseconds
        s = s.replace(/-/,"/").replace(/-/,"/");
        s = s.replace(/T/," ").replace(/Z/," UTC");
        s = s.replace(/([\+\-]\d\d)\:?(\d\d)/," $1$2"); // -04:00 -> -0400
        return new Date(s);
    }
    function datetime(elem) {
        var iso8601 = isTime(elem) ? elem.getAttribute("datetime") : elem.getAttribute("title");
        return parse(iso8601);
    }
    function isTime(elem) {
        return elem.tagName.toLowerCase() === "time";
    }

    function timeagoElement(elem) {
        refresh(elem);
        if (settings.refreshMillis > 0)
            setInterval(refresh.bind(null, elem), settings.refreshMillis);
    }

    function refresh(elem) {
        var datetime = prepareDateTime(elem);
        if (!isNaN(datetime))
            elem.textContent = inWords(datetime);
    }

    function prepareDateTime(elem) {
        var timeagoAttr = elem.getAttribute("timeago");
        if (timeagoAttr)
            return new Date(timeagoAttr);
        var data = datetime(elem);
        elem.setAttribute("timeago", data);
        var text = elem.textContent.trim();
        if (text.length > 0 && !(isTime(elem) && elem.title))
            elem.title = text;
        return data;
    }

    function inWords(date) {
        return distanceInWords(distance(date));
    }

    function distance(date) {
        return (new Date().getTime() - date.getTime());
    }

    // fix for IE6 suckage
    document.createElement("abbr");
    document.createElement("time");

    module.exports = timeago;
});