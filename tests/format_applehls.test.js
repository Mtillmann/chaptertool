
import { readFileSync } from "fs";
import { sep } from "path";
import { ChaptersJson } from "../src/Formats/ChaptersJson.js";
import { AppleHLS } from "../src/Formats/AppleHLS.js";


describe('AppleHLS Format Handler', () => {
    it('accepts no arguments', () => {
        expect(() => {
            new AppleHLS();
        }).not.toThrowError(TypeError);
    });


    it('fails on malformed input', () => {
        expect(() => {
            new AppleHLS('asdf');
        }).toThrowError(Error);
    });

    const content = readFileSync(module.path + sep + 'samples' + sep + 'applehls.json', 'utf-8');

    it('parses well-formed input', () => {
        expect(() => {
            new AppleHLS(content);
        }).not.toThrow(Error);
    });

    const instance = new AppleHLS(content);

    it('has the correct number of chapters from content', () => {
        expect(instance.chapters.length).toEqual(3);
    });

    it('has parsed the timestamps correctly', () => {
        expect(instance.chapters[1].startTime).toBe(500.1)
    });

    it('has parsed the chapter titles correctly', () => {
        expect(instance.chapters[0].title).toBe('birth')
    });

    it('exports to correct format', () => {
        expect(instance.toString()).toContain('start-time":');
    });

    it('export includes correct timestamp', () => {
        expect(instance.toString()).toContain('1200.2');
    });

    it('can import previously generated export', () => {
        expect(new AppleHLS(instance.toString()).chapters[2].startTime).toEqual(1200.2);
    });

    it('can convert into other format', () => {
        expect(instance.to(ChaptersJson)).toBeInstanceOf(ChaptersJson)
    });

});
