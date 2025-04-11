import * as zip from '@zip.js/zip.js'
import { Offcanvas } from 'bootstrap'
import { AutoFormat } from '@mtillmann/chapters'

export default {
  exportOffcanvas: null,
  exportSettings: {
    type: 'chaptersjson',
    supportsPretty: false,
    pretty: true,
    hasImages: false,
    canUseImagePrefix: false,
    imagePrefix: '',
    writeRedundantToc: false,
    writeEndTimes: false,
    psdFramerate: 23.976,
    psdOmitTimecodes: false,
    acUseTextAttr: false,
    miscTextType: 'spotifya'
  },
  exportContent: '',
  exportData: null,
  miscTextTypes: [
    'spotifya',
    'spotifyb',
    'podcastpage',
    'transistorfm',
    'podigeetext',
    'shownotes'
  ],
  initExportDialog () {
    for (const type of this.miscTextTypes) {
      if (this.selectedFormats.includes(type)) {
        this.exportSettings.miscTextType = type
        break
      }
    }

    this.exportOffcanvas = new Offcanvas(this.$refs.exportDialog)
    this.$refs.exportDialog.addEventListener('show.bs.offcanvas', () => {
      this.updateExportContent()
    })
  },
  updateExportContent (type) {
    if (type) {
      this.exportSettings.type = type
    }

    const actualType = this.exportSettings.type === 'misctext' ? this.exportSettings.miscTextType : this.exportSettings.type

    this.data.ensureUniqueFilenames()
    this.exportData = AutoFormat.as(actualType, this.data)
    this.exportSettings.hasImages = this.data.chapters.some(item => item.img && item.img_type === 'blob')
    this.exportSettings.canUseImagePrefix = this.data.chapters.some(item => item.img && ['blob', 'relative'].includes('blob'))

    this.exportSettings.supportsPretty = this.exportData.supportsPrettyPrint
    this.exportContent = this.exportData.toString(this.exportSettings.pretty, {
      imagePrefix: this.exportSettings.imagePrefix,
      writeRedundantToc: this.exportSettings.writeRedundantToc,
      writeEndTimes: this.exportSettings.writeEndTimes,
      psdFramerate: this.exportSettings.psdFramerate,
      psdOmitTimecodes: this.exportSettings.psdOmitTimecodes,
      acUseTextAttr: this.exportSettings.acUseTextAttr
    })
  },

  download () {
    gtag('event', 'ui', { action: 'download', format: this.exportData.constructor.name })

    this.triggerDownload(({
      url: URL.createObjectURL(new Blob([this.exportContent], { type: this.exportData.mimeType })),
      name: this.exportData.filename
    }))
  },

  triggerDownload (options) {
    const a = document.createElement('a')
    a.setAttribute('href', options.url)
    a.setAttribute('download', options.name)
    a.click()
  },

  copyToClipboard () {
    this.$refs.outputTextarea.select()
    document.execCommand('copy')
    window.getSelection()?.removeAllRanges()

    gtag('event', 'ui', { action: 'copy', format: this.exportData.constructor.name })

    this.toast('copied to clipboard')
  },

  async downloadZip () {
    gtag('event', 'ui', { action: 'downloadZip', format: this.exportData.constructor.name })

    let zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'), { bufferedWrite: true })

    await zipWriter.add('chapters.json', new zip.BlobReader(new Blob([this.exportContent], { type: 'text/plain' })), { level: 0 })

    for (const chapter of this.data.chapters) {
      const response = await fetch(chapter.img)
      const blob = await response.blob()

      await zipWriter.add(chapter.img_filename, new zip.BlobReader(blob), { level: 0 })
    }

    const closed = await zipWriter.close()
    this.triggerDownload(({
      url: URL.createObjectURL(closed), name: 'chapters.zip'
    }))

    zipWriter = null
  }
}
