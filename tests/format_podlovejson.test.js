
import { readFileSync } from "fs";
import { sep } from "path";
import { ShutterEDL } from "../src/Formats/ShutterEDL.js";
import { PodloveJson } from "../src/Formats/PodloveJson.js";


describe('PodloveJson Format Handler', () => {
    it('accepts no arguments', () => {
        expect(() => {
            new PodloveJson();
        }).not.toThrowError(TypeError);
    });


    it('fails on malformed input', () => {
        expect(() => {
            new PodloveJson('asdf');
        }).toThrowError(Error);
    });

    const content = readFileSync(module.path + sep + 'samples' + sep + 'podlove.json', 'utf-8');

    it('parses well-formed input', () => {
        expect(() => {
            new PodloveJson(content);
        }).not.toThrow(Error);
    });

    const instance = new PodloveJson(content);

    it('has the correct number of chapters from content', () => {
        expect(instance.chapters.length).toEqual(3);
    });

    it('has parsed the timestamps correctly', () => {
        expect(instance.chapters[1].startTime).toBe(754)
    });

    it('has parsed the chapter titles correctly', () => {
        expect(instance.chapters[0].title).toBe('Intro')
    });

    it('exports to correct format', () => {
        expect(instance.toString()).toContain('start":"');
    });

    it('export includes correct timestamp', () => {
        expect(instance.toString()).toContain('00:12:34.000');
    });

    it('can import previously generated export', () => {
        expect(new PodloveJson(instance.toString()).chapters[2].startTime).toEqual(3723);
    });

    it('can convert into other format', () => {
        expect(instance.to(ShutterEDL)).toBeInstanceOf(ShutterEDL)
    });

});
