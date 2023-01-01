import {enforceMilliseconds, hash, secondsToTimestamp, timestampToSeconds} from "../util.js";
import filenamify from "filenamify";

export class FormatBase {

    supportsPrettyPrint = false;
    chapterTitleTemplate = 'Chapter $chapter of $total';
    chapters = [];
    defaultMeta = {
        author: '',
        title: '',
        podcastName: '',
        description: '',
        fileName: '',
        waypoints: false,
        version: '1.0.0'
    };

    filename = 'chapters.json';
    mimeType = 'application/json';

    duration = 0;

    isChapterFormat = true;

    constructor(input = null, extraProperties = {}) {
        Object.entries(extraProperties).forEach(([key, value]) => this[key] = value);

        this.meta = {...this.defaultMeta}

        if (!input) {
            //do nothing, just initialize
        } else if (typeof input === 'string') {
            this.parse(input);
        } else if ('isChapterFormat' in input) {
            this.chapters = JSON.parse(JSON.stringify(input.chapters));
            this.meta = {...this.meta, ...JSON.parse(JSON.stringify(input.meta))};
        }


        if (this.chapters.length > 0) {
            let chapter = this.chapters.at(-1);
            if (chapter.endTime) {
                this.duration = chapter.endTime;
            } else if (chapter.startTime) {
                this.duration = chapter.startTime;
            }
        }
        if (this.duration === 0) {
            this.duration = 3600;
        }


        this.bump();
    }

    detect(inputString) {
        try {
            const data = JSON.parse(inputString);
            const {errors} = this.test(data);
            if (errors.length > 0) {
                throw new Error('data test failed');
            }
        } catch (e) {
            return false;
        }
        return true;
    }

    test(data) {
        if (!('chapters' in data)) {
            return {errors: ['JSON Structure: missing "chapters"']};
        }
        if (!('version' in data)) {
            return {errors: ['JSON Structure: missing "version"']};
        }
        return {errors: []};
    }

    bump(keepDuration = false) {
        this.chapters.sort((a, b) => a.startTime - b.startTime);
        const lastChapter = this.chapters.at(-1);

        if (lastChapter && !keepDuration) {
            this.duration = Math.max(parseFloat(this.duration || 0), parseFloat(lastChapter.endTime || 0), parseFloat(lastChapter.startTime || 0));
        }

        this.chapters = this.chapters.map((chapter, index) => {
            const endTime = this.endTime(index);
            const duration = endTime - this.chapters[index].startTime;
            const timestampOptions = {hours: false};
            return {
                ...{
                    id: hash(),
                    startTime: 0
                },
                ...chapter,
                ...{
                    endTime,
                    duration,
                    startTime_hr: secondsToTimestamp(chapter.startTime, timestampOptions),
                    endTime_hr: secondsToTimestamp(endTime, timestampOptions),
                    duration_hr: secondsToTimestamp(duration, timestampOptions)
                }, ...('toc' in chapter ? {} : {toc: true})
            }
        });
    }

    endTime(index) {
        /*
        if (!recalculateEndTime && 'endTime' in this.chapters[index]) {
            return this.chapters[index].endTime;
        }
         */
        return this.chapters[index + 1] ? (this.chapters[index + 1].startTime - 0.001) : this.duration;
    }

    expandFirstToStart() {
        this.chapters[0].startTime = 0;
        this.bump();
    }

    add(chapter) {
        this.chapters.push(chapter);
        this.bump();
    }

    remove(index) {
        if (this.chapters[index] && this.chapters[index].img && this.chapters[index].img.slice(0, 5) === 'blob:') {
            URL.revokeObjectURL(this.chapters[index].img)
        }
        this.chapters.splice(index, 1)
        this.bump();
    }

    to(className) {

        return new className(this);
    }

    parse(string) {
        const data = JSON.parse(string);
        const {errors} = this.test(data);
        if (errors.length > 0) {
            throw new Error(errors.join(''));
        }


        this.chapters = data.chapters;

        this.chapters = this.chapters.map(chapter => {
            if ('img' in chapter) {
                if (chapter.img.slice(0, 4) === 'http') {
                    chapter.img_type = 'absolute';
                } else {
                    chapter.img_type = 'relative';
                    chapter.img_filename = chapter.img;
                }
            }
            return chapter;
        })

        this.meta = Object.fromEntries(Object.entries(this.meta).map(([key, value]) => [key, data[key] || value]));
    }

    toString(pretty = false, exportOptions = {}) {
        const options = {
            ...
                {
                    imagePrefix: '',
                    writeRedundantToc: false,
                    writeEndTimes: false
                }, ...exportOptions
        };
        const defaultMetaProperties = Object.keys(this.defaultMeta);
        return JSON.stringify(
            {
                ...Object.fromEntries(
                    Object.entries(this.meta).filter(([key, value]) => {
                        return defaultMetaProperties.includes(key) && value !== '' && value !== false;
                    })
                ),
                ...{
                    chapters: this.chapters.map(chapter => {
                        let filtered = {
                            startTime: enforceMilliseconds(chapter.startTime)
                        };

                        if (options.writeEndTimes) {
                            filtered.endTime = enforceMilliseconds(chapter.endTime);
                        }

                        if ('toc' in chapter && chapter.toc === false) {
                            filtered.toc = false;
                        }
                        if (!('toc' in filtered) && options.writeRedundantToc) {
                            filtered.toc = true;
                        }

                        ['location', 'img', 'url', 'title'].forEach(property => {
                            if (property in chapter && chapter[property].trim().length > 0) {
                                filtered[property] = chapter[property];
                            }
                        });

                        if ('img_filename' in chapter && 'img' in filtered) {
                            filtered.img = filenamify(chapter.img_filename);
                        }

                        if (options.imagePrefix.trim().length > 0 && 'img' in filtered && ['relative', 'blob'].includes(chapter.img_type)) {
                            filtered.img = options.imagePrefix + filtered.img;
                        }


                        return filtered;
                    })
                }
            }
            , null, pretty ? 2 : null);
    }

    stringToLines(string) {
        return string.split(/\r?\n/)
            .filter(line => line.trim().length > 0)
            .map(line => line.trim());
    }

    applyChapterMinLength(seconds) {
        const originalIdMap = this.chapters.map(chapter => chapter.id);
        const newChapters = [];
        let elapsed = 0;
        let currentChapter;

        this.chapters.forEach(chapter => {
            elapsed += chapter.duration;
            if (!currentChapter) {
                currentChapter = chapter;
            }
            if (elapsed >= seconds) {
                delete currentChapter.endTime;
                delete currentChapter.duration;
                newChapters.push(currentChapter);
                currentChapter = 0;
                elapsed = 0;
            }
        });

        this.chapters = newChapters;
        this.bump();

        const newIdMap = Object.fromEntries(this.chapters.map((c, i) => [c.id, i]));
        return Object.fromEntries(originalIdMap.map((id, index) => {
            return [index, id in newIdMap ? newIdMap[id] : 'deleted']
        }));
    }

    addChapterAt(index) {

        let startTime = 0;
        if (index > this.chapters.length) {
            let start = this.chapters.at(-1) ? this.chapters.at(-1).startTime : 0;
            startTime = start + (this.duration - start) * .5;
        } else if (index === 0) {
            startTime = 0;
        } else {
            let start = this.chapters.at(index - 1).startTime;
            let end = this.chapters.at(index) ? this.chapters.at(index).startTime : this.duration;
            startTime = start + (end - start) * .5;
        }

        this.chapters.push({
            id: hash(),
            startTime
        })

        this.bump();
        return startTime;
    }

    addChapterAtTime(startTime, inputChapter = {}) {
        if (this.chapterExistsAtStartTime(startTime)) {
            return false;
        }

        this.chapters.push({
            ...{
                id: hash(),
                startTime
            }, ...inputChapter
        });
        this.bump();

        return true;
    }

    rebuildChapterTitles(template = null) {
        this.chapters.forEach((chapter, index) => {
            this.chapters[index].title = this.getChapterTitle(index, template);
        })
    }

    getChapterTitle(index, template = null) {
        template = template || this.chapterTitleTemplate;
        return template.replace('$chapter', index + 1).replace('$total', this.chapters.length)
    }

    chapterExistsAtStartTime(time) {
        return this.chapters.filter(c => c.startTime === time).length > 0;
    }


    updateChapterStartTime(index, startTime) {
        const newStartTime = timestampToSeconds(startTime);
        if (this.chapterExistsAtStartTime(newStartTime)) {
            return 'timeInUse';
        }

        if (newStartTime > this.duration) {
            this.duration = newStartTime;
        }

        this.chapters[index].startTime = newStartTime;
        this.bump();
        return newStartTime;
    }

    chapterIndexFromStartTime(startTime) {
        return this.chapters.reduce((newIndex, chapter, index) => {
            if (chapter.startTime === startTime) {
                newIndex = index;
            }
            return newIndex;
        }, 0);
    }

    chapterIndexFromTime(time) {
        return this.chapters.reduce((newIndex, chapter, index) => {
            if (time > chapter.startTime) {
                newIndex = index;
            }
            return newIndex;
        }, false);
    }

    ensureUniqueFilenames(){
        const usedFilenames = [];
        this.chapters = this.chapters.map(chapter => {
            if (chapter.img_type !== 'blob') {
                return chapter;
            }

            chapter.img_filename = filenamify(chapter.img_filename);

            let filename = chapter.img_filename;
            if(usedFilenames.includes(filename)){
                filename = filename.replace(/(\.\w+)$/,`_${hash()}$1`);
                chapter.img_filename = filename;
            }
            usedFilenames.push(filename);

            return chapter;
        });

    }
}