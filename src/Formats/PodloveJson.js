import { secondsToTimestamp, timestampToSeconds } from '../util.js';
import { FormatBase } from './FormatBase.js';


export class PodloveJson extends FormatBase{

    filename = 'podlove-chapters.json';
    mimeType = 'application/json';

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

        if(!data.every(chapter => 'start' in chapter)){
            return { errors: ['JSON Structure: every chapter must have a start property'] };
        }
        
        return { errors: [] };
    }

    
    parse(string) {
        const data = JSON.parse(string);
        const {errors} = this.test(data);
        if (errors.length > 0) {
            throw new Error(errors.join(''));
        }

        this.chapters = data.map(raw => {
            const {start, title, image, href} = raw;
            const chapter = {
                startTime: timestampToSeconds(start)
            }
            if(title){
                chapter.title = title;
            }
            if(image){
                chapter.img = image;
            }
            if(href){
                chapter.href = href;
            }
            return chapter;
        });
    }

    toString(pretty = false){
        return JSON.stringify(this.chapters.map(chapter => ({
            start: secondsToTimestamp(chapter.startTime, {milliseconds: true}),
            title: chapter.title || '',
            image: chapter.img || '',
            href: chapter.href || ''
        })), null, pretty ? 2 : 0);
    }

}