![chaptertool](../static/icons/icon-180.png)

# chaptertool

Create and _convert_ chapters for podcasts, youtube, matroska, mkvmerge/nero/vorbis, webvtt, ffmpeginfo, ffmetadata, pyscenedetect, apple chapters, edl, podlove simple chapters (xml, json), apple hls chapters and mp4chaps.

> Build on [@mtillmann/chapters](https://github.com/Mtillmann/chapters)

## [Web App](https://mtillmann.github.io/chaptertool)

[Click here to open the web app](https://mtillmann.github.io/chaptertool).

## Supported Formats

| name | key | ext    | info |
|-------|------|--------|------|
| Podcasting 2.0 Chapters | chaptersjson | `json` | [spec](https://github.com/Podcastindex-org/podcast-namespace/blob/main/chapters/jsonChapters.md) |
| FFMetadata | ffmpegdata | `txt`  | [spec](https://ffmpeg.org/ffmpeg-formats.html#Metadata-1) |
| Matroska XML chapters | matroskaxml | `xml`  | [spec](https://www.matroska.org/technical/chapters.html) |
| MKVToolNix mkvmerge XML | mkvmergexml | `xml`  | [spec](https://mkvtoolnix.download/doc/mkvmerge.html#mkvmerge.chapters) |
| MKVToolNix mkvmerge _simple_ | mkvmergesimple | `txt`  | [spec](https://mkvtoolnix.download/doc/mkvmerge.html#mkvmerge.chapters) |
| WebVTT Chapters | webvtt | `vtt`  | [spec](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API) |
| Youtube Chapter Syntax | youtube | `txt`  |  |
| FFMpegInfo | ffmpeginfo | `txt`  | read only, used internally |
| PySceneDetect | pyscenedetect | `csv`  | [project home](https://github.com/Breakthrough/PySceneDetect) |
| Vorbis Comment Format | vorbiscomment | `txt`  | [spec](https://wiki.xiph.org/Chapter_Extension) |
| "Apple Chapters" | applechapters | `xml`  | [source](https://github.com/rigaya/NVEnc/blob/master/NVEncC_Options.en.md#--chapter-string:~:text=CHAPTER03NAME%3Dchapter%2D3-,apple%20format,-(should%20be%20in)) |
| Shutter EDL | edl | `edl`  | [source](https://github.com/paulpacifico/shutter-encoder/blob/f3d6bb6dfcd629861a0b0a50113bf4b062e1ba17/src/application/SceneDetection.java) |
| Podlove Simple Chapters | psc | `xml`  | [spec](https://podlove.org/simple-chapters/) |
| Podlove Simple Chapters JSON | podlovejson | `json` | [source](https://github.com/podlove/chapters#:~:text=org/%3E-,Encode%20to%20JSON,-iex%3E%20Chapters) |
| MP4Chaps | mp4chaps | `txt`  | [source](https://github.com/podlove/chapters#:~:text=%3Achapters%3E-,Encode%20to%20mp4chaps,-iex%3E%20Chapters) |
| Apple HLS Chapters | applehls | `json` | [spec](https://developer.apple.com/documentation/http-live-streaming/providing-javascript-object-notation-json-chapters), partial support |
| SceneCut | scenecut | `json` | [spec](https://github.com/slhck/scenecut-extractor#:~:text=cuts%20in%20JSON-,format,-%3A) |

| name                  | key            | ext    | info                                                                                                                                                               |
| ---------------------------- | -------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Podcasting 2.0 Chapters      | chaptersjson   | `json` | [spec](https://github.com/Podcastindex-org/podcast-namespace/blob/main/chapters/jsonChapters.md)                                                                   |
| FFMetadata                   | ffmpegdata     | `txt`  | [spec](https://ffmpeg.org/ffmpeg-formats.html#Metadata-1)                                                                                                          |
| Matroska XML chapters        | matroskaxml    | `xml`  | [spec](https://www.matroska.org/technical/chapters.html)                                                                                                           |
| MKVToolNix mkvmerge XML      | mkvmergexml    | `xml`  | [spec](https://mkvtoolnix.download/doc/mkvmerge.html#mkvmerge.chapters)                                                                                            |
| MKVToolNix mkvmerge _simple_ | mkvmergesimple | `txt`  | [spec](https://mkvtoolnix.download/doc/mkvmerge.html#mkvmerge.chapters)                                                                                            |
| WebVTT Chapters              | webvtt         | `vtt`  | [spec](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API)                                                                                                |
| Youtube Chapter Syntax       | youtube        | `txt`  |                                                                                                                                                                    |
| FFMpegInfo                   | ffmpeginfo     | `txt`  | read only, used internally                                                                                                                                         |
| PySceneDetect                | pyscenedetect  | `csv`  | [project home](https://github.com/Breakthrough/PySceneDetect)                                                                                                      |
| Vorbis Comment Format        | vorbiscomment  | `txt`  | [spec](https://wiki.xiph.org/Chapter_Extension)                                                                                                                    |
| "Apple Chapters"             | applechapters  | `xml`  | [source](https://github.com/rigaya/NVEnc/blob/master/NVEncC_Options.en.md#--chapter-string:~:text=CHAPTER03NAME%3Dchapter%2D3-,apple%20format,-(should%20be%20in)) |
| Shutter EDL                  | edl            | `edl`  | [source](https://github.com/paulpacifico/shutter-encoder/blob/f3d6bb6dfcd629861a0b0a50113bf4b062e1ba17/src/application/SceneDetection.java)                        |
| Podigee Chapters/Chaptermarks | podigee | `json` | [spec](https://app.podigee.com/api-docs#!/ChapterMarks/updateChapterMark:~:text=Model-,Example%20Value,-%7B%0A%20%20%22title%22%3A%20%22string%22%2C%0A%20%20%22start_time)                                                                                                                        | 
| Podlove Simple Chapters      | psc            | `xml`  | [spec](https://podlove.org/simple-chapters/)                                                                                                                       |
| Podlove Simple Chapters JSON | podlovejson    | `json` | [source](https://github.com/podlove/chapters#:~:text=org/%3E-,Encode%20to%20JSON,-iex%3E%20Chapters)                                                               |
| MP4Chaps                     | mp4chaps       | `txt`  | [source](https://github.com/podlove/chapters#:~:text=%3Achapters%3E-,Encode%20to%20mp4chaps,-iex%3E%20Chapters)                                                    |
| Apple HLS Chapters           | applehls       | `json` | [spec](https://developer.apple.com/documentation/http-live-streaming/providing-javascript-object-notation-json-chapters), partial support                          |
| Scenecut format              | scenecut       | `json` | [source](https://github.com/slhck/scenecut-extractor#:~:text=cuts%20in%20JSON-,format,-%3A)                                                                        |
| Audible Chapter Format         | audible        | `json` | [source](./audible-chapter-spec.md)                                                                                                                               |
| Spotify Formats A/B | spotifya\|spotifyb | `txt` | [see](https://github.com/Mtillmann/chapters/blob/main/misc-text-chapter-spec.md) |
| Podcastpage Format | podcastpage | `txt` | [see](https://github.com/Mtillmann/chapters/blob/main/misc-text-chapter-spec.md) |
| Podigee Text Format | podigeetext | `txt` | [see](https://github.com/Mtillmann/chapters/blob/main/misc-text-chapter-spec.md) |
| TransistorFM Chapter Format | transistorfm | `txt` | [see](https://github.com/Mtillmann/chapters/blob/main/misc-text-chapter-spec.md) |
| Unknown Shownotes Format | shownotes | `txt` | [see](https://github.com/Mtillmann/chapters/blob/main/misc-text-chapter-spec.md) |


## CLI

An updated cli tool with better interface is available here: [chapconv](https://github.com/Mtillmann/chapconv)

If you want to extract chapters from videos, rather use native ffmpeg or pyscenedetect commands and integrate chapconv in your pipeline. Here is the [old CLI Documentation](/cli.md). 

## Examples & FAQ

[examples.md](/examples.md), [FAQ](/faq.md)

## Docker

Use docker to run the web GUI:

```shell
docker build -t chaptertool-gui .
docker run -p 8989:8989 chaptertool-gui
# open http://localhost:8989 in your browser
```

or use the image from dockerhub:

```shell
docker run -p 8989:8989 martintillmann/chaptertool-gui
```
