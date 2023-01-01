import {FormatBase} from "./FormatBase.js";


export class MatroskaXML extends FormatBase {

    supportsPrettyPrint = true;
    filename = 'matroska-chapters.xml';
    mimeType = 'text/xml';

    constructor(input, extraProperties = null) {
        super(input, extraProperties || {
            chapterStringNodeName: 'ChapString',
            inputTimeToSeconds: string => parseFloat(string) / 1e9,
            secondsToOutputTime: seconds => parseInt(seconds * 1e9)
        });
    }

    detect(inputString) {
        return /^<\?xml/.test(inputString.trim()) && /<Chapters>/.test(inputString) && inputString.indexOf(`<${this.chapterStringNodeName}>`) > -1;
    }

    parse(string) {
        if (!this.detect(string)) {
            throw new Error('Input needs xml declaration and a <Chapters> node');
        }

        const dom = (new DOMParser()).parseFromString(string, 'application/xml');
        this.chapters = [...dom.querySelectorAll('ChapterAtom')].map(chapter => {
            return {
                title: chapter.querySelector(this.chapterStringNodeName).textContent,
                startTime: this.inputTimeToSeconds(chapter.querySelector('ChapterTimeStart').textContent),
                endTime: this.inputTimeToSeconds(chapter.querySelector('ChapterTimeEnd').textContent),
            };
        });

    }

    toString(pretty = false) {
        const indent = (depth, string, spacesPerDepth = 2) => (pretty ? ' '.repeat(depth * spacesPerDepth) : '') + string;

        let output = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<!DOCTYPE Chapters SYSTEM "matroskachapters.dtd">',
            '<Chapters>',
            indent(1, '<EditionEntry>'),
            indent(2, `<EditionUID>${Date.now()}${parseInt(Math.random() * 1e6)}</EditionUID>`)
        ];

        this.chapters.forEach((chapter, index) => {

            output.push(indent(2, '<ChapterAtom>'));
            output.push(indent(3, `<ChapterTimeStart>${this.secondsToOutputTime(chapter.startTime)}</ChapterTimeStart>`));
            output.push(indent(3, `<ChapterTimeEnd>${this.secondsToOutputTime(chapter.endTime)}</ChapterTimeEnd>`));
            output.push(indent(3, `<ChapterUID>${parseInt(1 + chapter.startTime)}${parseInt(Math.random() * 1e6)}</ChapterUID>`));
            output.push(indent(3, '<ChapterDisplay>'));
            output.push(indent(4, `<${this.chapterStringNodeName}>${chapter.title || this.getChapterTitle(index)}</${this.chapterStringNodeName}>`));
            output.push(indent(3, '</ChapterDisplay>'));
            output.push(indent(2, '</ChapterAtom>'));
        });

        output.push(
            indent(1, '</EditionEntry>'),
            '</Chapters>'
        );

        return output.join(pretty ? "\n" : '');
    }
}