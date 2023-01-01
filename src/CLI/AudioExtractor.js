import {execSync, spawn} from "child_process";
import {basename, extname} from "path";
import {addSuffixToPath} from "../cli_util.js";

export class AudioExtractor {
    options = null;

    constructor(options) {
        this.options = options;
    }

    extract() {
        if (!('extractAudio' in this.options) && !('audioOnly' in this.options)) {
            return true;
        }


        if ('audioCopyStream' in this.options) {
            let ffProbeArgs = [`-i "${this.options.input}"`, '-v 0 -select_streams a -show_entries "stream=codec_name"'];
            const ffprobeCallString = [this.options.ffprobeBinary, ...ffProbeArgs].join(' ');
            const ffProbeOutput = execSync(ffprobeCallString, {shell: true});
            if ('dumpFfmpeg' in this.options) {
                console.log(ffprobeCallString);
            }

            const codec = /codec_name=(.*)/.exec(ffProbeOutput.toString())[1];
            let codecToExtensionMap = {
                aac: 'm4a',
                mp3: 'mp3',
                opus: 'opus',
                vorbis: 'ogg',
            };

            if (!(codec in codecToExtensionMap)) {
                throw new Error(`no file extension for codec ${codec}`);
            }

            let fileExtension = codecToExtensionMap[codec];
            delete this.options.audioCopyStream;
            this.options.audioFilename = this.options.audioFilename.replace(/\.[\w\d]{2,}$/, `.${fileExtension}`);
            this.options.audioOptions = '-map a -acodec copy';

            this.extract();

        } else {


            let filename = basename(this.options.input);
            let extension = extname(filename);
            filename = filename.replace(new RegExp(`${extension}$`), '');


            this.options.audioFilename = this.options.audioFilename.replace('$filename', filename);
            if (this.options.overwriteMode === '-n') {
                let outputExtension = extname(this.options.audioFilename);
                this.options.audioFilename = addSuffixToPath(this.options.audioFilename.replace(new RegExp(`${outputExtension}$`), ''), outputExtension);
            }

            let ffmpegArgs = [`-i "${this.options.input}"`, this.options.audioOptions, this.options.overwriteMode, `"${this.options.audioFilename}"`];

            if ('dumpFfmpeg' in this.options) {
                console.log(`${this.options.ffmpegBinary} ${ffmpegArgs.join(' ')}`);
                return true;
            }

            const ffmpegCall = spawn(this.options.ffmpegBinary, ffmpegArgs, {shell: true});

            if (!this.options.silent) {
                ffmpegCall.stdout.on("data", d => console.log(d.toString()))
                ffmpegCall.stderr.on("data", d => console.log(d.toString()))
            }

            return true;
        }
    }
}