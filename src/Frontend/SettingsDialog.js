import { Modal } from 'bootstrap'
import { AutoFormat } from '@mtillmann/chapters'

export default {

  availableFormats: [],
  selectedFormats: [],
  settingsModal: null,
  initSettingsDialog () {
    this.selectedFormats = JSON.parse(localStorage.getItem('ct-selectedFormats') ?? '[]')
    if (this.selectedFormats.length === 0) {
      this.selectedFormats = Object.keys(AutoFormat.classMap).filter(key => key !== 'ffmpeginfo')
    }

    this.availableFormats = Object.entries(AutoFormat.classMap).reduce((acc, entry) => {
      const [key, value] = entry
      if (key !== 'ffmpeginfo') {
        acc.push({
          key,
          name: value.name
        })
      }
      return acc
    }, []).sort((a, b) => a.name.localeCompare(b.name))

    this.settingsModal = new Modal(this.$refs.settingsDialog)
  },

  toggleFormat (key) {
    if (this.selectedFormats.includes(key)) {
      this.selectedFormats = this.selectedFormats.filter(item => item !== key)
    } else {
      this.selectedFormats.push(key)
    }

    localStorage.setItem('ct-selectedFormats', JSON.stringify(this.selectedFormats))
  },

  showSettingsDialog () {
    this.settingsModal.show()
  },
  isFormatSelectedClass (key, key2 = null) {
    const keySelected = !(this.availableFormats.find(item => item.key === key).selected)
    const key2Selected = !(key2 ? this.availableFormats.find(item => item.key === key2).selected : true)

    console.log({
      key,
      key2,
      keySelected,
      key2Selected,
      x: !keySelected && !key2Selected
    })

    // return an object that contains d-none when both keySelected and key2Selected are false
    return { 'd-none': !keySelected && !key2Selected }

    // return { xxx:true, 'd-none': !keySelected && !key2Selected }
  }

}
