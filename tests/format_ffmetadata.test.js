import {FFMetadata} from "../src/Formats/FFMetadata.js";
import {WebVTT} from "../src/Formats/WebVTT.js";
import {readFileSync} from "fs";
import {sep} from "path";
import {ChaptersJson} from "../src/Formats/ChaptersJson.js";


describe('FFMetadata Format Handler', () => {
    it('accepts no arguments', () => {
        expect(() => {
            new FFMetadata();
        }).not.toThrowError(TypeError);
    });


    it('fails on malformed input', () => {
        expect(() => {
            new FFMetadata('asdf');
        }).toThrowError(Error);
    });

    const content = readFileSync(module.path + sep + 'samples' + sep + 'FFMetadata.txt', 'utf-8');

    it('parses well-formed input', () => {
        expect(() => {
            new FFMetadata(content);
        }).not.toThrow(Error);
    });

    const instance = new FFMetadata(content);

    it('has the correct number of chapters from content', () => {
        expect(instance.chapters.length).toEqual(5);
    });

    it('has the correct title from content', () => {
        expect(instance.meta.title).toEqual('this is a episode title!');
    });

    it('has parsed the timestamps correctly', () => {
        expect(instance.chapters[0].startTime).toBe(6.202)
    });

    it('has parsed the chapter titles correctly', () => {
        expect(instance.chapters[0].title).toBe('Chapter 1 of 5')
    });

    it('exports to correct format',() => {
        expect(instance.toString().slice(0,12)).toEqual(';FFMETADATA1');
    });

    it('export includes correct timestamp',() => {
        expect(instance.toString()).toContain('658241');
    });

    it('can import previously generated export',() => {
        expect(new FFMetadata(instance.toString()).chapters[3].endTime).toEqual(542.001);
    });

    it('can convert into other format', () => {
        expect(instance.to(WebVTT)).toBeInstanceOf(WebVTT)
    });

});
