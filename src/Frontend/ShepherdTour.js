import Shepherd from "shepherd.js";

export class ShepherdTour {

    tour = null;

    constructor() {


        this.tour = new Shepherd.Tour({
            useModalOverlay: true,
            keyboardNavigation: false,

            defaultStepOptions: {
                classes: 'shadow-md bg-purple-dark',
                scrollTo: true,
                canClickTarget: false,
                cancelIcon: {
                    enabled: true
                },
                buttons: [
                    {
                        text: 'Next',
                        action() {
                            return this.next()
                        }
                    }
                ]
            }
        });

        ['cancel', 'complete'].forEach(eventName => this.tour.on(eventName, () => {
            localStorage.setItem('ct-tour-seen', 'true');
            if (document.querySelectorAll('.list-chapter').length > 0 && confirm('reset app?')) {
                window.dispatchEvent(new CustomEvent('generic:reset'));
            }
        }));


        window.addEventListener('keyup', e => {
            if (e.key === 'ArrowRight' && this.tour.isActive()) {
                this.tour.next();
            }
        })

        this.tour.addSteps([
            {
                id: 'describe-timeline',
                text: 'Clicking anywhere on the timeline brings up the marker.',
                attachTo: {
                    element: '.timeline',
                    on: 'bottom'
                },
            }, {
                id: 'describe-timeline-insert-button',
                text: 'The <i class="bi bi-bookmark-plus"></i> button creates a new chapter at the selected time.',
                attachTo: {
                    element: function () {
                        return '.timeline .marker .btn-group .insert';
                    },
                    on: 'bottom'
                },

                beforeShowPromise() {
                    return new Promise(function (resolve) {
                        window.timeline.updateMarker(document.querySelector('.timeline').getBoundingClientRect().width * .5, 0.5)
                        setTimeout(() => {
                            resolve();
                        }, 120);

                    });
                },

                when: {
                    hide() {
                        document.querySelector('.timeline').classList.remove('clicked');
                    }
                }
            }, {
                id: 'show-new-chapter-in-timeline',
                text: 'The new chapter has been added below the timeline as a segment&hellip;',
                attachTo: {
                    element: function () {
                        return '.chapters .chapter';
                    },
                    on: 'bottom'
                },
                beforeShowPromise() {
                    return new Promise(function (resolve) {
                        window.dispatchEvent(new CustomEvent('timeline:add', {detail: {startTime: 1800}}));
                        setTimeout(() => {
                            resolve();
                        }, 120);

                    });
                }
            }, {
                id: 'show-new-chapter-in-list',
                text: '&hellip; and is also rendered in the chapter list on the left.',
                attachTo: {
                    element: function () {
                        return '.list-chapter';
                    },
                    on: 'bottom'
                }
            }, {
                id: 'show-lower-add-button',
                text: 'You can add chapters from the chapter list before and after existing chapters.',
                attachTo: {
                    element: function () {
                        return [...document.querySelectorAll('.add-chapter-in-list-btn')].pop();
                    },
                    on: 'bottom'
                }
            }, {
                id: 'show-new-chapters-in-timeline',
                text: 'All chapters are shown as segments below the timeline. Clicking a segment selects a chapter.',
                attachTo: {
                    element: function () {
                        return '.chapters';
                    },
                    on: 'bottom'
                },
                beforeShowPromise() {
                    return new Promise(function (resolve) {
                        window.dispatchEvent(new CustomEvent('timeline:add', {detail: {startTime: 0}}));
                        window.dispatchEvent(new CustomEvent('timeline:add', {detail: {startTime: 3600 * 0.75}}));
                        setTimeout(() => {
                            resolve();
                        }, 120);
                    });
                }
            }, {
                id: 'show-edit-box',
                text: 'Once selected, you can edit a chapter\'s attributes here.',
                attachTo: {
                    element: function () {
                        return '[x-ref="chapterList"]+div';
                    },
                    on: 'left'
                }
            }, {
                id: 'show-timestampedit-button',
                text: 'Edit a chapter\'s timestamp by either clicking this button, the chapter\'s timestamp link in the list or by dragging the chapter segment\'s left edge.',
                attachTo: {
                    element: function () {
                        return '#chapterStartTime';
                    },
                    on: 'left'
                }
            }, {
                id: 'show-timestampedit-dialog',
                text: 'Once the chapter\'s timestamp is updated, the timeline and chapter list are also updated. Expanding a chapters timestamp beyond the current duration will expand the duration.',
                attachTo: {
                    element: function () {
                        return '#timestampEditDialog';
                    },
                    on: 'top'
                },
                beforeShowPromise() {
                    return new Promise(function (resolve) {
                        document.querySelector('#timestampEditDialog').addEventListener('shown.bs.offcanvas', function () {
                            resolve();
                        });
                        document.querySelector('#chapterStartTime').click();
                    });
                },

            }, {
                id: 'show-close-button',
                text: 'Close the chapter edit dialog here to return to the main menu.',
                attachTo: {
                    element: function () {
                        return '[x-ref="chapterList"]+div .nav-item.ms-auto';
                    },
                    on: 'left'
                },

                beforeShowPromise() {
                    document.querySelector('#chapterStartTime').click();
                    return new Promise(function (resolve) {
                        document.querySelector('#timestampEditDialog input').value = '00:50:00';
                        document.querySelector('#timestampEditDialog .offcanvas-body button').click();

                        resolve();

                    });
                }
            }, {
                id: 'explain-main-menu',
                text: 'Access features that are not related to single chapters from here.',
                attachTo: {
                    element: '[x-ref="chapterList"]+div .text-center',
                    on: 'left'
                },
                beforeShowPromise: function () {
                    return new Promise(function (resolve) {
                        document.querySelector('[x-ref="chapterList"]+div .nav-item.ms-auto a').click();
                        setTimeout(() => {
                            resolve();
                        }, 120)
                    });
                }
            }, {
                id: 'explain-navi-toggle',
                text: 'The same features can be accessed at any time from the offcanvas menu.',
                attachTo: {
                    element: 'header .flex-column',
                    on: 'left'
                }
            }, {
                id: 'show-open-navi',
                text: 'Let\'s focus on the export feature.',
                attachTo: {
                    element: '#navi .offcanvas-export-link',
                    on: 'left'
                },
                beforeShowPromise: function () {
                    return new Promise(function (resolve) {
                        document.querySelector('#navi').addEventListener('shown.bs.offcanvas', function () {
                            resolve();
                        });
                        document.querySelector('header .flex-column a').click();
                    });
                }
            }, {
                id: 'show-format-tabs',
                text: 'Select an export format.',
                attachTo: {
                    element: '#exportDialog .nav',
                    on: 'top'
                },
                beforeShowPromise: function () {
                    return new Promise(function (resolve) {
                        document.querySelector('#exportDialog').addEventListener('shown.bs.offcanvas', function () {
                            resolve();
                        });
                        document.querySelector('#navi .offcanvas-export-link').click();
                    });
                }
            }, {
                id: 'show-export-options',
                text: 'Toggle export settings if needed. The output will be updated immediately.',
                attachTo: {
                    element: '#exportDialog .col-4',
                    on: 'left'
                }
            }, {
                id: 'show-export-options',
                text: 'Finally, download the data or copy it to the clipboard.',
                attachTo: {
                    element: '#exportDialog .col-8 > div',
                    on: 'top'
                }
            }, {
                id: 'done',
                text: 'That\s it. You can run this tour again from the offcanvas navigation at any time. Have fun.',
                attachTo: {
                    on: 'center'
                },
                buttons: [
                    {
                        text: 'Done',
                        action() {
                            return this.next();
                        }
                    }
                ]
            }
        ]);


        if (!localStorage.getItem('ct-tour-seen') || /show-tour/.test(window.location.hash)) {
            window.location.hash = '';
            this.show();
        }


    }

    show() {
        this.tour.start();
    }
}
