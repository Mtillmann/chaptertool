import {basename, extname, sep} from "path";
import {renameSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, lstatSync} from "fs";
import {spawn, execSync} from "child_process";
import {secondsToTimestamp, zeroPad} from "../util.js";
import {addSuffixToPath} from "../cli_util.js";
import {FFMpegInfo} from "../Formats/FFMpegInfo.js";
import {ChaptersJson} from "../Formats/ChaptersJson.js";
import {AutoFormat} from "../Formats/AutoFormat.js";

export class ChapterGenerator {

    options = null;

    constructor(options) {
        this.options = options;
    }

    infoTxtToChaptersJson(infoTxt) {
        const chapters = new FFMpegInfo(infoTxt);

        if (!this.options.noEndTimes) {
            if (chapters.chapters.at(-1)) {
                chapters.chapters.at(-1).endTime = this.getVideoLength();
            } else {
                chapters.addChapterAt(0);
            }
            chapters.bump();
        }

        const changes = chapters.applyChapterMinLength(this.options.minChapterLength);
        chapters.rebuildChapterTitles(this.options.chapterTemplate);
        Object.entries(changes).forEach(([index, newIndex]) => {

            index = parseInt(index);
            if (newIndex === 'deleted') {
                try {
                    unlinkSync(`${this.options.outputFolder}/chapter_${zeroPad(index + 1, 5)}.jpg`);
                } catch (e) {
                    //may fail when first is removed...
                }
            } else {
                newIndex = parseInt(newIndex);
                if(index === newIndex){
                    return;
                }
                try {
                    renameSync(
                        `${this.options.outputFolder}/chapter_${zeroPad(index + 1, 5)}.jpg`,
                        `${this.options.outputFolder}/chapter_${zeroPad(newIndex + 1, 5)}.jpg`
                    );
                } catch (e) {
                    //might fail when no image is present
                }
            }
        });

        chapters.chapters.forEach((chapter, i) => {
            chapters.chapters[i].img = `chapter_${zeroPad(i + 1, 5)}.jpg`
        });

        if (this.options.imgUri) {
            chapters.applyImgUri(this.options.imgUri);
        }


        return chapters.to(ChaptersJson);
    }

    async generate() {
        if (this.options.audioOnly) {
            return true;
        }

        let filename = basename(this.options.input);
        let extension = extname(filename);
        filename = filename.replace(new RegExp(`${extension}$`), '');
        this.options.outputFolder = this.options.outputFolder.replace('$filename', filename);

        this.options.outputFolder = addSuffixToPath(this.options.outputFolder);

        if (!('dumpFfmpeg' in this.options)) {
            mkdirSync(this.options.outputFolder);
        }

        if ('inputChapters' in this.options) {
            this.snapshotsFromChapters();
            return true;
        }

        let ffmpegArgs = [`-i "${this.options.input}"`];

        let filters = [];

        if ('crop' in this.options) {
            filters.push(`crop=${this.options.crop}`)
        }
        if ('scale' in this.options) {
            if (typeof this.options.scale === 'number') {
                filters.push(`scale=${this.options.scale}:-2`)
            } else {
                filters.push(this.options.scale);
            }
        }

        if (this.options.useCrossfadeFix) {
            filters.push(`select='not(mod(n,${this.options.crossfadeFrames}))'`);
        }

        filters.push(`select='gt(scene,${this.options.sceneValue})'`);
        filters.push(`metadata=print:file=${this.options.outputFolder}/info.txt`)

        if (this.options.useCrossfadeFix) {
            ffmpegArgs.push(`-filter_complex "${filters.join(',')}"`);
        } else {
            ffmpegArgs.push(`-vf "${filters.join(',')}"`);
        }

        ffmpegArgs.push(this.options.overwriteMode);

        ffmpegArgs.push(`-vsync vfr "${this.options.outputFolder + sep}chapter_%05d.jpg"`)

        await this.ffmpegCall(ffmpegArgs, false, () => {
            const info = readFileSync(`${this.options.outputFolder}/info.txt`, 'utf-8');
            const chapters = AutoFormat.as(this.options.outputFormat, this.infoTxtToChaptersJson(info));
            writeFileSync(`${this.options.outputFolder}/${chapters.filename}`, chapters.toString(this.options.pretty));
            if (!('keepInfo' in this.options)) {
                unlinkSync(`${this.options.outputFolder}/info.txt`);
            }
        });

    }

    snapshotsFromChapters() {
        lstatSync(this.options.inputChapters);
        let json = JSON.parse(readFileSync(this.options.inputChapters, 'utf-8'));


        let filters = [];

        if ('crop' in this.options) {
            filters.push(`crop=${this.options.crop}`)
        }
        if ('scale' in this.options) {
            if (typeof this.options.scale === 'number') {
                filters.push(`scale=${this.options.scale}:-2`)
            } else {
                filters.push(this.options.scale);
            }
        }

        json.chapters.forEach(chapter => {
            let ffmpegArgs = [`-ss ${secondsToTimestamp(chapter.startTime)}`, `-i "${this.options.input}"`];
            if (filters.length > 0) {
                ffmpegArgs.push(`-vf "${filters.join(',')}"`);
            }
            ffmpegArgs.push(`-vframes 1 "${this.options.outputFolder + sep}${basename(chapter.img)}"`);
            this.ffmpegCall(ffmpegArgs, true);
        });
    }

    async ffmpegCall(args, sync = false, onExit) {
        if ('dumpFfmpeg' in this.options) {
            console.log(`${this.options.ffmpegBinary} ${args.join(' ')}`);
            return true;
        }

        if (sync) {
            execSync(`${this.options.ffmpegBinary} ${args.join(' ')}`, {
                shell: true,
                [this.options.silent ? 'stdio' : 'whatever']: 'pipe'
            });
        } else {

            const ffmpegCall = spawn(this.options.ffmpegBinary, args, {shell: true});
            if (!this.options.silent) {
                ffmpegCall.stdout.on("data", d => console.log(d.toString()))
                ffmpegCall.stderr.on("data", d => console.log(d.toString()))
            }

            if (onExit) {
                ffmpegCall.on('exit', onExit)
            }
        }
    }

    getVideoLength() {
        let ffProbeArgs = ['-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1', `-i "${this.options.input}"`];
        const ffprobeCallString = [this.options.ffprobeBinary, ...ffProbeArgs].join(' ');
        const ffProbeOutput = execSync(ffprobeCallString, {shell: true});

        return parseFloat(ffProbeOutput.toString());
    }

}