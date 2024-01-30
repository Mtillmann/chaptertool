
import { readFileSync } from "fs";
import { sep } from "path";
import { FFMetadata } from "../src/Formats/FFMetadata.js";
import { PodloveSimpleChapters } from "../src/Formats/PodloveSimpleChapters.js";


describe('PodloveSimpleChapters Format Handler', () => {
    it('accepts no arguments', () => {
        expect(() => {
            new PodloveSimpleChapters();
        }).not.toThrowError(TypeError);
    });


    it('fails on malformed input', () => {
        expect(() => {
            new PodloveSimpleChapters('asdf');
        }).toThrowError(Error);
    });

    const content = readFileSync(module.path + sep + 'samples' + sep + 'podlove-simple-chapters.xml', 'utf-8');

    it('parses well-formed input', () => {
        expect(() => {
            new PodloveSimpleChapters(content);
        }).not.toThrow(Error);
    });

    const instance = new PodloveSimpleChapters(content);

    it('has the correct number of chapters from content', () => {
        expect(instance.chapters.length).toEqual(4);
    });

    it('has parsed the timestamps correctly', () => {
        expect(instance.chapters[1].startTime).toBe(187)
    });

    it('has parsed the chapter titles correctly', () => {
        expect(instance.chapters[0].title).toBe('Welcome')
    });

    it('exports to correct format', () => {
        expect(instance.toString()).toContain('psc:chapters');
    });

    it('export includes correct timestamp', () => {
        expect(instance.toString()).toContain('3:07');
    });

    it('can import previously generated export', () => {
        expect(new PodloveSimpleChapters(instance.toString()).chapters[1].startTime).toEqual(187);
    });

    it('can convert into other format', () => {
        expect(instance.to(FFMetadata)).toBeInstanceOf(FFMetadata)
    });

});
