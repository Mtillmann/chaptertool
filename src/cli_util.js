import {existsSync} from "fs";

export function addSuffixToPath(path, extension = null) {
    let suffix = 0;
    //check if this runs with previously borked condition below
    //if (extension && !extension.slice(0, 1) === '.') {
    if (extension && extension.slice(0, 1) !== '.') {
        extension = '.' + extension;
    }
    while (existsSync(path + (suffix < 1 ? '' : '_' + suffix) + (extension ? extension : ''))) {
        suffix++;
    }

    return path + (suffix < 1 ? '' : '_' + suffix) + (extension ? extension : '');
}
