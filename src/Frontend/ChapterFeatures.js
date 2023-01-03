import {Offcanvas} from "bootstrap";

export default {

    chapterDialog: null,
    initChapterDialog() {
        this.chapterDialog = new Offcanvas(this.$refs.chapterDialog);
        this.$refs.chapterDialog.addEventListener('shown.bs.offcanvas', () => {
            gtag('event', 'meta', {action : 'attributeDialog'});
        });
    }
}