import Alpine from "alpinejs";
import {Offcanvas, Toast, Tooltip} from "bootstrap";
import Timeline from "./Frontend/Timeline.js";
import {secondsToTimestamp, timestampToSeconds} from "./util.js";
import {FileHandler} from "./Frontend/FileHandler.js";
import MediaFeatures from "./Frontend/MediaFeatures.js";
import ExportFeatures from "./Frontend/ExportFeatures.js";
import ChapterFeatures from "./Frontend/ChapterFeatures.js";
import {ChaptersJson} from "./Formats/ChaptersJson.js";
import ImportDialog from "./Frontend/ImportDialog.js";

window.Alpine = Alpine;

window.GAIsDeployed = false;
window.deployGA = () => {

    if (window.GAIsDeployed) {
        return;
    }

    const script = document.createElement('script');
    [
        ['async', true],
        ['src', `https://www.googletagmanager.com/gtag/js?id=${window.GACODE}`]
    ].forEach(([key, value]) => script.setAttribute(key, value));

    document.body.insertAdjacentElement('beforeend', script)
    window.GAIsDeployed = true;
};

window.dataLayer = window.dataLayer || [];

window.gtag = function () {
    window.dataLayer.push(arguments);
}

gtag('js', new Date());
gtag('set', {
    'page_title': 'chaptertool'
});


window.addEventListener('DOMContentLoaded', () => {
    document.documentElement.dataset.bsTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    window.timeline = new Timeline(3600, [], document.querySelector('.timeline'));
    Alpine.start();


    fetch('ga-code').then(r => r.text())
        .then(code => {
            window.GACODE = code;
            if (!localStorage.getItem('ct-analytics-state')) {
                (new Offcanvas(document.querySelector('#analyticsDialog'), {
                    keyboard: false,
                    backdrop: 'static'
                })).show()
            }
            if (localStorage.getItem('ct-analytics-state') === 'enabled') {
                window.deployGA();
            }
        });
})

window.APP = {
    ...{
        chapters: [],
        data: new ChaptersJson(),
        editTimestampLabel: '',
        editTimestampTimestamp: [0, 0],
        editTimestampCallback: null,
        editTimestampBounds: {min: 0, max: '10:10:10'},
        editTimestampChapter: 0,
        currentChapterIndex: null,
        fileHandler: false,
        editTab: 'info',
        chapterBelowIndex: false,
        chapterLock: true,
        offcanvasNavi: null,
        analyticsEnabled: false,
        analyticsIsAvailable: false,

        init() {
            this.offcanvasNavi = new Offcanvas(this.$refs.navi);
            this.$refs.navi.addEventListener('show.bs.offcanvas', () => {
                gtag('event', 'navi', 'show');
            });


            this.tooltip = new Tooltip(document.body, {
                selector: '.has-tooltip',
                animation: false,
                //placement: 'aut',
                trigger: 'hover',
                html: true,
                customClass: 'small'
            });

            this.analyticsEnabled = localStorage.getItem('ct-analytics-state') === 'enabled';

            setTimeout(() => {
                this.analyticsIsAvailable = !!window.GACODE;
            }, 1000);

            this.fileHandler = new FileHandler();

            this.timestampOffcanvas = new Offcanvas(this.$refs.timestampedit);
            this.$refs.timestampedit.addEventListener('shown.bs.offcanvas', () => {
                this.$refs.timestampedit.querySelector('[type=time]').focus()
            })

            this.$refs.timestampedit.querySelector('form').addEventListener('submit', e => {
                e.preventDefault();
                this.editTimestampCallback(Array.from(e.target.querySelectorAll('input')).map(i => i.value).join('.'));
                this.timestampOffcanvas.hide();
            });


            window.addEventListener('timeline:add', e => {
                this.addChapterAtTime(e.detail.startTime, {}, 'timeline')
            })

            window.addEventListener('timeline:move', e => {
                this.updateChapterStartTime(parseInt(e.detail.index), secondsToTimestamp(e.detail.startTime), true, 'dragdrop');
            });

            window.addEventListener('timeline:scrollintoview', e => {
                this.editChapter(e.detail.index)
            });

            window.addEventListener('dragndrop:video', e => {
                if (this.data.chapters.length > 0 || this.hasVideo || this.hasAudio) {
                    this.showImportDialog({
                        mode: 'video',
                        video: e.detail.video,
                        name: e.detail.name
                    });
                    return;
                }

                this.attachVideo(e.detail.video);
            });

            window.addEventListener('dragndrop:audio', e => {

                this.attachAudio(e.detail.audio);
            });


            window.addEventListener('dragndrop:image', e => {
                if (this.currentChapterIndex !== null) {
                    this.data.chapters[this.currentChapterIndex].img_type = e.detail.type || 'blob';
                    this.data.chapters[this.currentChapterIndex].img = e.detail.image;
                    this.data.chapters[this.currentChapterIndex].img_filename = e.detail.name;

                    this.getImageInfo(this.currentChapterIndex);

                }
            });

            window.addEventListener('timeline:marker-set', e => {

                if (!this.chapterLock) {
                    return;
                }

                const index = this.data.chapterIndexFromTime(e.detail.time);
                if (index !== false) {
                    this.editChapter(index);
                } else {
                    this.closeChapter();
                }
            });

            window.addEventListener('dragndrop:jsonfail', () => {
                this.toast('file could not be processed :/')
            });

            window.addEventListener('dragndrop:json', e => {
                if (this.data.chapters.length > 0 || this.hasVideo || this.hasAudio) {
                    this.showImportDialog({
                        mode: 'data',
                        data: e.detail.data,
                        name: e.detail.name
                    });
                    return;
                }
                this.newProject(e.detail.data);
            });

            this.initExportDialog();
            this.initChapterDialog();
            this.initImportDialog();
        },

        toggleGA(state /* undefined|enabled|disabled */) {
            let hasState = true;
            let currentState = localStorage.getItem('ct-analytics-state');
            if (!currentState) {
                hasState = false;
            }
            if (!state) {
                state = currentState === 'disabled' ? 'enabled' : 'disabled';
            }

            localStorage.setItem('ct-analytics-state', state);
            this.analyticsEnabled = state === 'enabled';

            if (state === 'enabled') {
                window.deployGA();
            }

            Offcanvas.getInstance(document.querySelector('#analyticsDialog'))?.hide();

            if (!hasState) {
                this.toast(`analytics ${state}`);
            } else {
                this.toast(`analytics ${state} - reload page for it to take effect`);
            }
        },

        askForNewProject() {
            if (this.data.chapters.length > 0 && !confirm('discard current project?')) {
                gtag('event', 'askForNew', 'reject');
                return;
            }
            gtag('event', 'askForNew', 'confirm');
            this.newProject();
        },

        newProject(data) {
            gtag('event', 'createNew');
            this.reset();
            this.$nextTick(() => {
                this.data = data || new ChaptersJson();
                this.updateTimeline();
                this.importModal.hide();
            });
        },

        scrollChapterIntoView(index) {
            this.$refs.chapterList.querySelectorAll('.list-chapter')[index].scrollIntoView({block: 'center'});
        },

        editChapter(index) {
            this.$nextTick(() => {
                this.scrollChapterIntoView(index);
                this.currentChapterIndex = index;
                window.timeline.setActive(index);
            });
        },

        toast(message, options = {}) {

            [...this.$refs.toasts.querySelectorAll('.toast.show')].slice(1).forEach(node => {
                node.classList.remove('show');
                node.classList.add('hide')
            });

            this.$refs.toasts.insertAdjacentHTML('afterbegin', `
                <div style="--bs-toast-spacing:0.5rem" class="toast small" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-body px-2 py-1">${message}</div>
                </div>
            `);
            (new Toast(this.$refs.toasts.querySelector('.toast'), {
                ...{
                    delay: 1666
                }, ...options
            })).show()
        },

        changeDuration() {
            this.editTimestamp(
                `Edit Duration`,
                this.data.duration,
                {
                    max: '23:59:59',
                    min: secondsToTimestamp(this.data.chapters.at(-1) ? this.data.chapters.at(-1).startTime : 0).slice(0, 8)
                },
                (newTimestamp) => {
                    gtag('event', 'durationChange');
                    this.data.duration = timestampToSeconds(newTimestamp);
                    this.data.bump(true);
                    this.updateTimeline();
                }
            );
        },
        editStartTime(chapterIndex) {
            this.editTimestampChapter = chapterIndex;
            this.editTimestamp(
                `Set chapter ${chapterIndex + 1} startTime`,
                this.data.chapters[chapterIndex].startTime,
                {max: '23:59:59', min: 0},
                newTimestamp => this.updateChapterStartTime(this.editTimestampChapter, newTimestamp, false)
            );
        },


        updateChapterStartTime(index, startTime, forceEdit = false, origin = 'dialog') {
            gtag('event', 'startTimeChange', origin);

            const result = this.data.updateChapterStartTime(index, startTime);
            if (result === 'timeInUse') {
                this.toast(`Given start time already in use`);
                return;
            }
            this.updateTimeline();
            const newIndex = this.data.chapterIndexFromStartTime(result);
            if (forceEdit) {
                this.editChapter(newIndex)
            } else {
                if (this.currentChapterIndex && this.currentChapterIndex === index && newIndex !== index) {
                    this.editChapter(newIndex);
                }
            }
            if (newIndex !== index) {
                this.toast(`moved chapter ${index + 1} to posiiton ${newIndex + 1}, and set start time to ${startTime}`);
            } else {
                this.toast(`changed chapter #${index + 1} start time to ${startTime}`);
            }
        },

        chapterImage(index) {
            if (!this.data.chapters[index] || !this.data.chapters[index].img) {
                return false;
            }

            try {
                new URL(this.data.chapters[index].img)
            } catch (e) {
                return false;
            }

            return this.data.chapters[index].img;
        },

        deleteChapter(index) {
            this.currentChapterIndex = null;
            gtag('event', 'deleteChapter');
            this.$nextTick(() => {
                this.data.remove(index);
                this.updateTimeline();
                document.querySelector('.tooltip')?.remove();
                this.toast(`deleted chapter #${index + 1}`);
            });
        },

        addChapterAtTime(startTime, options = {}, origin) {
            gtag('event', 'addChapterAtTime', origin);
            let chapter = {};
            if (options.title?.length > 0) {
                chapter.title = options.title;
            }

            if ('image' in options) {
                chapter.img = options.image;
                chapter.img_type = 'blob';
                chapter.img_filename = new URL(options.image).pathname + '.jpg';
            }

            const result = this.data.addChapterAtTime(startTime, chapter);
            if (!result) {
                this.toast(`a chapter already exists at ${secondsToTimestamp(startTime)}`);
                return;
            }

            this.$nextTick(() => {
                this.updateTimeline();
                this.currentChapterIndex = this.data.chapterIndexFromStartTime(startTime);
                this.editChapter(this.currentChapterIndex);

                if (!('image' in options) && this.hasVideo) {
                    //this depends on currentChapterIndex being set by editChapter
                    this.fetchVideoSnapshot(startTime);
                }

                this.toast(`added chapter at ${secondsToTimestamp(startTime)}`);
            });
        },

        addChapter(index) {
            if (index === 0 && this.data.chapters[0] && this.data.chapters[0].startTime === 0) {
                this.toast(`a chapter already exists at ${secondsToTimestamp(0)}`);
                return;
            }

            gtag('event', 'addChapterAtIndex');

            let startTime = this.data.addChapterAt(index);
            this.updateTimeline();

            this.toast(`added chapter at position ${index + 1} (${secondsToTimestamp(startTime)})`);

            this.$nextTick(() => {
                this.editChapter(index === Infinity ? this.data.chapters.length - 1 : index);
                if (this.hasVideo) {
                    //this depends on currentChapterIndex being set by editChapter
                    this.fetchVideoSnapshot(startTime);
                }
            });
        },

        //wraps util feature to expose to alpine template
        secondsToTimestamp(seconds) {
            return secondsToTimestamp(seconds)
        },

        updateTimeline() {
            this.fileHandler.editorHasProject = this.data.chapters.length > 0;
            window.timeline.setDuration(this.data.duration);
            window.timeline.setChapters(JSON.parse(JSON.stringify(this.data.chapters)));
        },

        editTimestamp(label, timestamp, bounds, callback) {
            if (parseFloat(timestamp) === timestamp) {
                timestamp = secondsToTimestamp(timestamp, {milliseconds: true});
            }

            this.editTimestampLabel = label;
            this.editTimestampBounds = bounds;
            this.editTimestampTimestamp = timestamp.split('.');

            this.editTimestampCallback = callback;
            this.timestampOffcanvas.show();
        },

        reset() {
            this.data.chapters.forEach(chapter => {
                if (chapter.img && chapter.img.slice(0, 5) === 'blob:') {
                    URL.revokeObjectURL(chapter.img)
                }
            });

            document.querySelectorAll('[src^=blob]').forEach(node => {
                console.log('revoking url...');
                URL.revokeObjectURL(node.getAttribute('src'));
            })

            this.actualMediaDuration = null;
            this.chapterLock = true;
            this.currentChapterIndex = null;
            this.data = new ChaptersJson();
            this.hasVideo = false;
            this.hasAudio = false;
            this.mediaIsCollapsed = false;
            this.fileHandler.editorHasProject = false;
            window.timeline.setMarkerAt(0);
            window.timeline.node.classList.remove('clicked');
        },

        closeChapter() {
            gtag('event', 'closeChapter');
            this.$nextTick(() => {
                this.currentChapterIndex = null;
                window.timeline.setActive(false);
            })
        },

        expandToFirstToStart() {
            gtag('event', 'startTimeChange', 'expand');
            this.data.expandFirstToStart();
            this.updateTimeline();
        },

        addChapterFromTime() {
            this.editTimestamp(
                `Add chapter at time`,
                this.data.duration * .5,
                {max: '23:59:59', min: 0},
                newTimestamp => this.addChapterAtTime(timestampToSeconds(newTimestamp), {}, 'dialog')
            );
        },
        adaptDuration() {
            gtag('event', 'adaptDuration');
            this.data.duration = this.actualMediaDuration;
            this.data.bump(true);
            this.updateTimeline();
            this.toast(`duration set to (${secondsToTimestamp(this.actualMediaDuration)})`);
            this.actualMediaDuration = null;
        },
        toggleChapterLock() {
            this.chapterLock = !this.chapterLock;
            gtag('event', 'toggleChapterLock', this.chapterLock ? 'locked' : 'unlocked')
        }
    },
    ...MediaFeatures,
    ...ExportFeatures,
    ...ChapterFeatures,
    ...ImportDialog
}