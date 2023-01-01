import escapeStringRegexp from "escape-string-regexp";
import {sep} from "path";
import Os from "os";
import {existsSync, lstatSync, readFileSync} from "fs";
import {parse} from 'yaml';

export class ArgumentParser {

    optionDefinition = {
        y: {},
        n: {},
        outputFormat: {
            default: 'chaptersjson'
        },
        outputFolder: {
            default: '$filename_chapters'
        },
        chapterTemplate: {
            default: 'Chapter $chapter of $total'
        },
        sceneValue: {
            default: 0.1, cast: 'float'
        },
        scale: {
            cast: 'int'
        },
        forceDar: {},
        crop: {},
        useCrossfadeFix: {},
        crossfadeFrames: {
            default: 120, cast: 'int'
        },
        serveAfterRun: {},
        serve: {},
        generate: {},
        port: {
            default: 8989, cast: 'int'
        },
        silent: {
            default: false
        },
        pretty: {
            default: false
        },
        imgUri: {
            default: ''
        },
        replace: {},
        keepInfo: {},
        dumpFfmpeg: {},
        //config : {},
        //config is special
        ffmpegBinary: {
            default: 'ffmpeg'
        },
        ffprobeBinary: {
            default: 'ffprobe'
        },
        extractAudio: {},
        audioFilename: {
            default: '$filename.mp3'
        },
        audioOptions: {
            default: '-q:a 0 -map a'
        },
        audioCopyStream: {
            default: true
        },
        audioOnly: {},
        overwriteMode: {
            //this is special and set by either --y or --n. Setting it directly will have no effect
            default: '-n'
        },
        inputChapters: {},
        dumpOptions: {},
        minChapterLength: {
            default: 10
        },
        noEndTimes: {
            default: false
        }
    };

    options = {};
    action = null;

    constructor() {

        for (const arg in this.optionDefinition) {
            if ('default' in this.optionDefinition[arg]) {
                this.options[arg] = this.optionDefinition[arg].default;
            }
        }

        for (const key in process.env) {
            if (key.slice(0, 4).toUpperCase() === 'CT_') {
                let actualKey = key.toLowerCase().slice(3).replace(/_(\w)/g, m => m[1].toUpperCase());
                this.options[actualKey] = this.prepareValue(actualKey, process.env[key]);
            }
        }

        process.argv.forEach(arg => {
            if (arg.slice(0, 9) === '--config=') {
                let filename = arg.slice(9);
                lstatSync(filename);
                let content = readFileSync(filename, 'utf-8');
                let parsed = parse(content);
                parsed.forEach(arg => {
                    let {key, value, isOption} = this.keyAndValueFromOption(arg);
                    if (isOption && key in this.optionDefinition) {
                        this.options[key] = this.prepareValue(key, value);
                    }
                });
            }
        });

        let expectsInput = false;
        process.argv.forEach(arg => {
            let {key, value} = this.keyAndValueFromOption(arg);

            if (['serve', 'generate', 'convert'].includes(key)) {
                this.action = key;
                this.options['@action'] = key;
                expectsInput = true;
                return true;
            }

            if (expectsInput) {
                if (this.action === 'serve' && arg[0].slice(0, 2) !== '--') {
                    key = key.replace(new RegExp(escapeStringRegexp(sep) + '$'), '');
                    if (Os.platform() === 'win32') {
                        //a trailing quote may appear, I guess due to powershell's escaping mechanism
                        key = key.replace(/"$/, '');
                    }
                    if (key && !lstatSync(key).isDirectory()) {
                        throw new Error(`input directory ${key} isn't a directory`);
                    }
                    expectsInput = false;
                    this.options.input = key;
                    return;
                }

                if (!existsSync(key)) {
                    throw new Error(`input file ${key} doesn't exist`);
                }
                this.options.input = key;
                expectsInput = false;
                return;
            }

            if (key in this.optionDefinition) {
                this.options[key] = this.prepareValue(key, value);
            }
        });

        if ('y' in this.options && !('n' in this.options)) {
            this.options.overwriteMode = '-y';
        }
        if (!('y' in this.options) && 'n' in this.options) {
            this.options.overwriteMode = '-n';
        }

        if ('forceDar' in this.options) {
            this.options.scale = `scale='max(iw,iw*sar)':'max(ih,ih/sar)'`;
        }

        if ('dumpOptions' in this.options) {
            console.log(this.options)
        }

    }

    keyAndValueFromOption(arg) {
        arg = arg.split('=');

        let key = arg.shift();
        let isOption = key.slice(0, 2) === '--';
        key = key.replace(/^--/, '');

        if (isOption) {
            key = key.replace(/-\w/g, m => m.slice(1).toUpperCase());
        }

        let value = arg ? arg.join('=') : null;
        return {key, value, isOption};
    }

    prepareValue(key, value) {
        if ('cast' in this.optionDefinition[key] && this.optionDefinition[key].cast === 'float') {
            value = parseFloat(value);
        }
        if ('cast' in this.optionDefinition[key] && this.optionDefinition[key].cast === 'int') {
            value = parseInt(value);
        }

        return value || true;
    }


}