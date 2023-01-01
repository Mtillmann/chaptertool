import {AutoFormat} from "../Formats/AutoFormat.js";
import {ChaptersJson} from "../Formats/ChaptersJson";

export class FileHandler {

    editorHasProject = false;

    constructor() {

        document.documentElement.addEventListener('paste', e => {
            if (e.target.matches('input')) {
                return;
            }

            const text = (e.clipboardData || window.clipboardData).getData('text');
            const files = [...(event.clipboardData || event.originalEvent.clipboardData).items]
                .filter(item => item.kind === 'file')
                .map(item => item.getAsFile());


            if (files[0]) {
                return this.handleFile(files[0], 'paste')
            }

            try {
                const url = new URL(text);
                if (/(jpg|png|jpeg|webm|gif)$/.test(url.pathname)) {
                    gtag('event', 'paste', 'image-url');
                    return window.dispatchEvent(new CustomEvent('dragndrop:image', {
                        detail: {
                            image: url.toString(),
                            type: 'absolute',
                            name: url.toString()
                        }
                    }));
                }
            } catch (e) {
                //do nothing
            }

            try {
                const detected = AutoFormat.from(text);
                const data = new ChaptersJson(detected);
                gtag('event', 'paste', 'data', detected.constructor.name);
                return window.dispatchEvent(new CustomEvent('dragndrop:json', {
                    detail: {
                        data,
                        name: 'clipboard paste'
                    }
                }));
            } catch (e) {
                return window.dispatchEvent(new CustomEvent('dragndrop:jsonfail', {detail: {}}));
            }

        })

        document.getElementById('app').addEventListener('dragover', e => {
            e.preventDefault();
        });

        document.getElementById('app').addEventListener('drop', e => {
            // Prevent default behavior (Prevent file from being opened)
            e.preventDefault();

            if (e.dataTransfer.items) {
                // Use DataTransferItemList interface to access the file(s)
                [...e.dataTransfer.items].forEach((item, i) => {
                    if (item.kind === 'file' && i === 0) {
                        const file = item.getAsFile();
                        this.handleFile(file, 'dragdrop');
                    } else if (item.kind === 'file' && i > 1) {
                        window.dispatchEvent(new CustomEvent('dragndrop:ignoredfile', {detail: {filename: '...'}}));
                    }
                });
            } else {
                [...e.dataTransfer.files].forEach((file, i) => {
                    if (i === 0) {
                        return this.handleFile(file, 'dragdrop');
                    }
                    window.dispatchEvent(new CustomEvent('dragndrop:ignoredfile', {detail: {filename: file.name}}));
                });
            }
        })
    }

    askForNewProject() {
        if (!this.editorHasProject) {
            return true;
        }
        return confirm('Do you want to discard the current project and start a new one?');
    }

    handleFile(file, origin = 'osDialog') {
        if (['text/plain', 'text/xml', 'application/json'].includes(file.type)) {
            fetch(URL.createObjectURL(file))
                .then(r => r.text())
                .then(text => {
                    try {
                        const detected = AutoFormat.from(text);
                        const data = new ChaptersJson(detected);
                        gtag('event', origin, 'data', detected.constructor.name);
                        return window.dispatchEvent(new CustomEvent('dragndrop:json', {
                            detail: {
                                data,
                                name: file.name
                            }
                        }));
                    } catch (e) {
                        // do nothing
                        return window.dispatchEvent(new CustomEvent('dragndrop:jsonfail', {detail: {}}));
                    }
                })
        }

        if (file.type.slice(0, 5) === 'video') {

            gtag('event', origin, 'video');

            window.dispatchEvent(new CustomEvent('dragndrop:video', {
                detail: {
                    video: URL.createObjectURL(file),
                    name: file.name
                }
            }));
            return;
        }

        if (file.type.slice(0, 5) === 'audio' && this.askForNewProject()) {
            gtag('event', origin, 'audio');

            window.dispatchEvent(new CustomEvent('dragndrop:audio', {
                detail: {
                    audio: URL.createObjectURL(file),
                    name: file.name
                }
            }));
            return;
        }

        if (file.type.slice(0, 5) === 'image') {
            gtag('event', origin, 'image');

            window.dispatchEvent(new CustomEvent('dragndrop:image', {
                detail: {
                    image: URL.createObjectURL(file),
                    name: file.name
                }
            }));
            return;
        }


        window.dispatchEvent(new CustomEvent('dragndrop:ignoredfile', {detail: {filename: file.name}}));

    }

}