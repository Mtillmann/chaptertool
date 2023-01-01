import {secondsToTimestamp, timestampToSeconds} from "../util.js";

export default class Timeline {

    isInitRun = true;
    hoverPosition = 0;
    clickPosition = 0;
    dragNode = false;
    dragNodeCoords = {};
    dragHandle = null;
    timecodeNode = null;
    currentBlobURL = null;
    color = null;

    constructor(duration, chapters = [], node, options = {}) {

        this.color = getComputedStyle(document.documentElement).getPropertyValue('--ct-fg-full');

        this.node = node;
        this.id = ((Math.random() * 10e16).toString(16)).split('.').shift();

        this.dragHandle = this.node.querySelector('.drag-handle');
        this.timecodeNode = this.node.querySelector('.timecode');


        this.options = {
            ...{
                backgroundWidth: 2560,
                backgroundHeight: 2560 * 0.05,
                secondSnap: 1
            }, ...options
        };

        this.node.querySelector('.backdrop .ratio').style.setProperty(
            '--bs-aspect-ratio',
            (this.options.backgroundHeight / this.options.backgroundWidth * 100) + '%'
        );

        this.setDuration(duration);
        this.setChapters(chapters);
        this.render();
        this.isInitRun = false;

        this.node.addEventListener('mousemove', this.mouseMoveHandler.bind(this));

        this.node.addEventListener('mouseout', () => {
            this.node.style.setProperty('--hover-display', 'none');
        })

        this.node.addEventListener('click', e => {
            e.preventDefault()

            const link = e.target.closest('a');
            if (link) {
                if (link.matches('.insert')) {
                    window.dispatchEvent(new CustomEvent('timeline:add', {detail: {startTime: this.clickPosition}}));
                }
                this.node.classList.remove('clicked');
                return;
            }

            const chapter = e.target.closest('.chapter');
            if (chapter) {
                const payload = {detail: {index: parseInt(chapter.dataset.index)}};
                window.dispatchEvent(new CustomEvent('timeline:scrollintoview', payload));
            }

            if (e.target.matches('.backdrop, .chapters')) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const progress = (x / rect.width);
                this.clickPosition = this.duration * progress;

                this.updateMarker(x, progress);
            }

        });

        this.node.querySelector('.chapters').addEventListener('mousedown', e => {
            if (e.target.matches('.bar')) {
                e.preventDefault();
                this.dragNode = e.target.closest('.chapter');

                const nodeBounds = this.node.getBoundingClientRect();
                const dragNodeBounds = this.dragNode.getBoundingClientRect();
                this.dragNodeCoords = {
                    left: dragNodeBounds.left - nodeBounds.left,
                    right: dragNodeBounds.right - nodeBounds.left
                };

                this.mouseMoveHandler(e);

                this.dragNode.classList.add('is-dragged')
                this.node.classList.add('dragging');
            }
        });


        document.body.addEventListener('mouseup', () => {
            this.node.classList.remove('dragging');
            if (this.dragNode) {
                this.dragNode.classList.remove('is-dragged');
                window.dispatchEvent(new CustomEvent('timeline:move', {
                    detail: {
                        index: this.dragNode.dataset.index,
                        startTime: this.hoverPosition
                    }
                }));
            }
            this.dragNode = false;
        })


    }

    setDuration(duration) {
        if (typeof duration !== 'number') {
            duration = timestampToSeconds(duration);
        }

        this.duration = duration;
        if (!this.isInitRun) {
            this.render();
        }
    }


    render() {
        this.createBackground();
        this.renderChapters();
    }

    createBackground() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.setAttribute('width', this.options.backgroundWidth);
        canvas.setAttribute('height', this.options.backgroundHeight);

        context.fillStyle = this.color;
        context.strokeStyle = this.color;


        const draw = (context, x, h, label) => {
            let y = (1 - (h * 0.75)) * this.options.backgroundHeight;
            x = x * this.options.backgroundWidth;

            context.moveTo(x, y);
            context.lineTo(x, this.options.backgroundHeight);

            if (label) {
                context.font = (this.options.backgroundHeight * 0.3 * (label.scale || 1)) + 'px sans-serif';
                context.fillText(label.text, x, y)
            }

        };

        context.textAlign = 'center';
        context.textBaseline = 'bottom';
        context.beginPath();
        for (let s = 0; s <= this.duration; s += 5) {
            if (s % 3600 === 0) {
                draw(context, s / this.duration, 0.8, s === 0 ? null : {
                    text: secondsToTimestamp(s).slice(0, 8)
                });
                continue;
            }

            if (s % 600 === 0 && this.duration <= 7200) {
                draw(context, s / this.duration, 0.5, {
                    text: secondsToTimestamp(s).slice(0, 8),
                    scale: 0.7
                });
                continue;
            }

            if (s % 900 === 0 && this.duration > 7200 && this.duration <= 14400) {
                draw(context, s / this.duration, 0.5, {
                    text: secondsToTimestamp(s).slice(0, 8),
                    scale: 0.7
                });
                continue;
            }

            if (s % 1800 === 0 && this.duration > 7200) {
                draw(context, s / this.duration, 0.5, {
                    text: secondsToTimestamp(s).slice(0, 8),
                    scale: 0.7
                });
                continue;
            }

            if (s % 60 === 0 && this.duration <= 7200) {
                draw(context, s / this.duration, 0.25);
            }

            if (s % 300 === 0 && this.duration > 7200) {
                draw(context, s / this.duration, 0.25);
            }

        }
        context.stroke();
        context.closePath();

        canvas.toBlob(blob => {

            const url = URL.createObjectURL(blob);

            this.node.querySelector('.backdrop .ratio').style.setProperty(
                'background-image',
                `url(${url})`
            )

            if (this.currentBlobURL) {
                URL.revokeObjectURL(this.currentBlobURL);
            }
            this.currentBlobURL = url;

        })
    }

    setChapters(chapters) {

        this.chapters = chapters;

        if (!this.isInitRun) {
            this.render();
        }
    }

    renderChapters() {
        this.node.querySelectorAll('.chapter').forEach(node => node.remove());

        const parentNodes = this.node.querySelector('.chapters');
        this.chapters.forEach((chapter, i) => {
            const nextStart = this.chapters[i + 1] ? this.chapters[i + 1].startTime : this.duration;
            const width = (chapter.uses_endTime ? (((chapter.endTime - chapter.startTime) / this.duration) * 100) : (((nextStart - chapter.startTime) / this.duration) * 100)) + '%';
            const node = document.createElement('div');
            const left = (chapter.startTime / this.duration) * 100;
            node.setAttribute('href', `#chapter_${i}`);
            node.classList.add('chapter', 'cursor-pointer');
            node.dataset.index = i;
            node.style.setProperty('left', left + '%');
            node.style.setProperty('width', width);


            const bar = document.createElement('div');
            bar.classList.add('bar');
            node.appendChild(bar)


            parentNodes.appendChild(node)


        })
    }

    setActive(index) {
        const active = this.node.querySelector('.chapter.active');
        if (active) {
            active.classList.remove('active');
        }

        if (index === false) {
            return;
        }
        this.node.querySelectorAll('.chapter')[index].classList.add('active');
    }

    mouseMoveHandler(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const progress = (x / rect.width);
        this.hoverPosition = this.duration * progress;


        this.node.style.setProperty('--x', x + 'px');
        this.node.style.setProperty('--progress', progress);
        this.node.style.setProperty('--y', y + 'px');
        this.node.style.setProperty('--hover-display', 'block');
        this.timecodeNode.dataset.text = secondsToTimestamp(this.hoverPosition).slice(0, 8);

        if (this.dragNode) {
            this.dragHandle.style.setProperty('left', x + 'px')

            let left = 0;
            let width = (this.dragNodeCoords.right - this.dragNodeCoords.left) - (x - this.dragNodeCoords.left);
            if (x >= this.dragNodeCoords.right) {
                left = width;
                width = width * -1;
            }

            this.dragHandle.style.setProperty('--width', width + 'px')
            this.dragHandle.style.setProperty('--left', left + 'px')
        }


    }

    setMarkerAt(timestamp) {
        const progress = timestamp / this.duration;
        const x = this.node.getBoundingClientRect().width * progress;
        this.clickPosition = timestamp;
        this.updateMarker(x, progress);
    }

    updateMarker(x, progress) {
        this.node.style.setProperty('--click-x', x + 'px');
        this.node.style.setProperty('--click-progress', progress);
        const insert = this.node.querySelector('.marker a.insert');
        const string = 'insert chapter at ' + secondsToTimestamp(this.clickPosition).slice(0, 8);
        insert.setAttribute('title', string);
        insert.dataset.bsOriginalTitle = string;
        this.node.classList.add('clicked');

        window.dispatchEvent(new CustomEvent('timeline:marker-set', {detail: {time: this.clickPosition}}));

    }

}