import { secondsToTimestamp, timestampToSeconds } from '../util.js';
import { FormatBase } from './FormatBase.js';


export class AppleHLS extends FormatBase {

    filename = 'apple-hls.json';
    mimeType = 'application/json';
    supportsPrettyPrint = true;

    titleLanguage = 'en';
    imageDims = [1280, 720];

    detect(inputString) {
        try {
            const data = JSON.parse(inputString);
            const { errors } = this.test(data);
            if (errors.length > 0) {
                throw new Error('data test failed');
            }
        } catch (e) {
            return false;
        }
        return true;
    }

    test(data) {
        if (!Array.isArray(data)) {
            return { errors: ['JSON Structure: must be an array'] };
        }

        if (data.length === 0) {
            return { errors: ['JSON Structure: must not be empty'] };
        }

        if (!data.every(chapter => 'chapter' in chapter && 'start-time' in chapter)) {
            return { errors: ['JSON Structure: every chapter must have a chapter and a start-time property'] };
        }

        return { errors: [] };
    }


    parse(string) {
        const data = JSON.parse(string);
        const { errors } = this.test(data);
        if (errors.length > 0) {
            throw new Error(errors.join(''));
        }

        this.chapters = data.map(raw => {
            const chapter = {
                startTime: parseFloat(raw['start-time'])
            }

            if ('titles' in raw && raw.titles.length > 0) {
                chapter.title = raw.titles[0].title;
            }

            if ('images' in raw && raw.images.length > 0) {
                chapter.img = raw.images[0].url;
            }

            return chapter;
        });
    }

    toString(pretty = false) {
        return JSON.stringify(this.chapters.map((c, i) => {

            const chapter = {
                'start-time': c.startTime,
                chapter: i + 1,
                titles: [
                    {
                        title: c.title || `Chapter ${i + 1}`,
                        language: this.titleLanguage
                    }
                ]
            }

            if (c.img) {
                chapter.images = [
                    {
                        'image-category': "chapter",
                        url: c.img,
                        'pixel-width': this.imageDims[0],
                        'pixel-height': this.imageDims[1]
                    }
                ]
            }

            return chapter;
        }), null, pretty ? 2 : 0);
    }

}