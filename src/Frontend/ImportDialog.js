import { Modal } from 'bootstrap'

export default {

  importState: {
    mode: null
  },
  importModal: null,
  initImportDialog () {
    this.importModal = new Modal(this.$refs.importDialog)
  },
  showImportDialog (state) {
    this.importState = state
    this.importModal.show()
  }
}
