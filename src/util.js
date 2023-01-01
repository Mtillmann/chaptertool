
export function zeroPad(num, len = 3) {
    return ("0".repeat(len) + String(num)).slice(len * -1);
}

export function secondsToTimestamp(s, options = {}) {
    options = {...{hours: true, milliseconds: false}, ...options};

    const date = new Date(parseInt(s) * 1000).toISOString();

    if (date.slice(11, 13) !== '00') {
        options.hours = true;
    }
    const hms = date.slice(options.hours ? 11 : 14, 19);

    if (options.milliseconds) {
        let fraction = '000';
        if (s.toString().indexOf('.') > -1) {
            fraction = (String(s).split('.').pop() + '000').slice(0, 3);
        }
        return hms + '.' + fraction;
    }
    return hms;
}

export function timestampToSeconds(timestamp, fixedString = false) {
    let [seconds, minutes, hours] = timestamp.split(':').reverse();
    let milliseconds = 0;
    if (seconds.indexOf('.') > -1) {
        [seconds, milliseconds] = seconds.split('.');
    }

    hours = parseInt(hours || 0);
    minutes = parseInt(minutes || 0);
    seconds = parseInt(seconds || 0);
    milliseconds = parseInt(milliseconds) / 1000;


    if (seconds > 59) {
        let extraMinutes = Math.floor(seconds / 60);
        minutes += extraMinutes;
        seconds -= extraMinutes * 60;
    }

    if (minutes > 59) {
        let extraHours = Math.floor(minutes / 60);
        hours += extraHours;
        minutes -= extraHours * 60;
    }

    if (fixedString) {
        return parseFloat((hours * 3600 + minutes * 60 + seconds + milliseconds).toFixed(3));
    }
    return hours * 3600 + minutes * 60 + seconds + milliseconds;
}

export function hash() {
    return (Math.random() + 1).toString(16).substring(7);
}

export function escapeRegExpCharacters(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export function enforceMilliseconds(seconds) {
    return parseFloat(seconds.toFixed(3));
}

export function formatBytes(bytes, decimals = 2, format = 'KB') {
    if (bytes < 1) {
        return '0 B';
    }
    const k = format === 'kB' ? 1000 : 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizes = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    const suffix = [format === 'kB' ? sizes[i].toLowerCase() : sizes[i], 'B'];
    if (format === 'KiB') {
        suffix.splice(1, 0, 'i');
    }
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + suffix.join('');
}