import { Modal } from 'bootstrap'
import { AutoFormat } from '@mtillmann/chapters'

export default {

  selectedFormats: [],
  settingsModal: null,
  initSettingsDialog () {
    const storedFormats = JSON.parse(localStorage.getItem('ct-selectedFormats') ?? '[]')

    this.selectedFormats = Object.entries(AutoFormat.classMap).reduce((acc, entry) => {
      const [key, value] = entry
      if (key !== 'ffmpeginfo') {
        acc.push({
          key,
          name: value.name,
          selected: storedFormats.length === 0 || storedFormats.includes(key)
        })
      }
      return acc
    }, []).sort((a, b) => a.name.localeCompare(b.name))

    this.settingsModal = new Modal(this.$refs.settingsDialog)

    this.settingsModal.show()
  },

  storeSettings () {
    const keys = this.selectedFormats.reduce((acc, item) => {
      if (item.selected) {
        acc.push(item.key)
      }
      return acc
    }
    , [])

    localStorage.setItem('ct-selectedFormats', JSON.stringify(keys))
  },

  showSettingsDialog (state) {
    this.settingsModal.show()
  }
}
