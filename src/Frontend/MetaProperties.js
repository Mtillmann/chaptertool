import { Offcanvas } from 'bootstrap'

export default {

  metaPropertiesDialog: null,
  initMetaPropertiesDialog () {
    this.metaPropertiesDialog = new Offcanvas(this.$refs.metaPropertiesDialog)
    this.$refs.metaPropertiesDialog.addEventListener('shown.bs.offcanvas', () => {
      gtag('event', 'meta', { action: 'attributeDialog' })
    })
  }
}
