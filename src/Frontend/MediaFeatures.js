import { formatBytes } from '../util.js'

export default {
  videoHandlersAttached: false,
  audioHandlersAttached: false,
  hasVideo: false,
  hasAudio: false,
  insertFrameOnSeek: false,
  ignoreNextSeekEvent: false,
  mediaIsCollapsed: false,
  actualMediaDuration: null,

  getVideoCanvas (callback) {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('width', this.$refs.video.videoWidth)
    canvas.setAttribute('height', this.$refs.video.videoHeight)
    const context = canvas.getContext('2d')

    context.drawImage(this.$refs.video, 0, 0)
    canvas.toBlob(blob => {
      callback(URL.createObjectURL(blob))
    })
  },

  attachVideo (video, keepChapters = false) {
    if (!keepChapters) {
      this.reset()
    }

    this.importModal.hide()

    if (!this.videoHandlersAttached) {
      this.videoHandlersAttached = true
      this.$refs.video.addEventListener('loadedmetadata', e => {
        const videoDuration = e.target.duration
        if (keepChapters) {
          this.actualMediaDuration = videoDuration
          console.log(this.actualMediaDuration)
        } else {
          this.data.duration = videoDuration
          this.actualMediaDuration = null
        }
        this.currentChapterIndex = null
        this.data.bump()
        this.updateTimeline()
      })

      this.$refs.video.addEventListener('seeked', e => {
        if (this.insertFrameOnSeek) {
          this.addImageFromVideoToChapter()
          this.insertFrameOnSeek = false

          if (this.$refs.video.dataset.returnToTime) {
            this.ignoreNextSeekEvent = true
            const seekTo = parseFloat(this.$refs.video.dataset.returnToTime)
            delete this.$refs.video.dataset.returnToTime
            this.$refs.video.currentTime = seekTo
          }

          if (this.$refs.video.dataset.resumeOnSeek === 'true') {
            this.$refs.video.play()
            delete this.$refs.video.dataset.resumeOnSeek
          }
        } else {
          if (this.ignoreNextSeekEvent) {
            this.ignoreNextSeekEvent = false
          } else {
            window.timeline.setMarkerAt(e.target.currentTime)
          }
        }
      })

      window.addEventListener('timeline:marker-set', e => {
        this.ignoreNextSeekEvent = true
        this.$refs.video.currentTime = e.detail.time
      })
    }

    this.hasVideo = true
    this.mediaIsCollapsed = false
    this.$refs.video.setAttribute('src', video)
    this.$refs.video.play()
  },

  fetchVideoSnapshot (startTime = false) {
    if (startTime === false) {
      startTime = this.$refs.video.currentTime
    }
    this.insertFrameOnSeek = true
    if (startTime !== this.$refs.video.currentTime) {
      this.$refs.video.dataset.returnToTime = this.$refs.video.currentTime
    }

    if (this.$refs.video.paused === false) {
      this.$refs.video.dataset.resumeOnSeek = 'true'
      this.$refs.video.pause()
    }
    this.$refs.video.currentTime = startTime
  },

  addImageFromVideoToChapter (index) {
    index = index || this.currentChapterIndex

    gtag('event', 'chapter', { action: 'videoStillToChapter' })

    this.getVideoCanvas(url => {
      this.data.chapters[index].img = url
      this.data.chapters[index].img_type = 'blob'
      this.data.chapters[index].img_filename = (new URL(url.slice(5)).pathname).slice(1) + '.png'
      this.getImageInfo(index)
    })
  },

  attachAudio (audio) {
    this.reset()
    if (!this.audioHandlersAttached) {
      this.audioHandlersAttached = true
      this.$refs.audio.addEventListener('loadedmetadata', e => {
        this.data.duration = e.target.duration
        this.updateTimeline()
      })
    }
    this.hasAudio = true
    this.$refs.audio.setAttribute('src', audio)
    this.$refs.audio.play()
  },

  deleteImage (index) {
    if (this.data.chapters[index].img.slice(0, 5) === 'blob:') {
      URL.revokeObjectURL(this.data.chapters[index].img)
    }

    gtag('event', 'chapter', { action: 'removeImage' })

    delete this.data.chapters[index].img
    delete this.data.chapters[index].img_type
    delete this.data.chapters[index].img_filename
  },

  getImageInfo (index) {
    const img = document.createElement('img')
    img.dataset.index = index
    img.addEventListener('load', e => {
      this.data.chapters[e.target.dataset.index].img_dims = `${e.target.naturalWidth}x${e.target.naturalHeight}`
    })
    img.setAttribute('src', this.data.chapters[index].img)

    const initObject = { index }
    fetch(this.data.chapters[index].img, initObject)
      .then(((initObject) => {
        return r => {
          const l = r.headers.get('content-length')
          this.data.chapters[initObject.index].img_size = formatBytes(l) + ` (${l} Bytes)`
        }
      })(initObject))
  },
  toggleMedia () {
    this.mediaIsCollapsed = !this.mediaIsCollapsed
    gtag('event', 'ui', { action: 'mediatoggle', mode: this.mediaIsCollapsed ? 'collapsed' : 'visible' })
    this.$refs.video.pause()
  }

}
