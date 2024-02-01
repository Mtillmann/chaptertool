# Examples


## generate

Some of the examples require [yt-dlp](https://github.com/yt-dlp/yt-dlp).   

### cropping

[This video](https://www.youtube.com/watch?v=rpDWoshRnME) is a podcast with a slideshow version on youtube that
only uses a small portion of the video:

```shell
yt-dlp "https://www.youtube.com/watch?v=rpDWoshRnME" -o cropme.webm
npx chaptertool@latest generate cropme.webm --crop="926:608:831:72"
```

### handling cross-fade slideshows

[This video](https://www.youtube.com/watch?v=EL9ftQJ3Yjw) is a podcast with a slideshow version on youtube that
unfortunately uses cross-fade transitions between slides. Scene detection fails with those transitions
because the difference between the frames during the the transition is very small.

```shell
yt-dlp "https://www.youtube.com/watch?v=EL9ftQJ3Yjw" -o crossfaded.webm
npx chaptertool@latest generate crossfaded.webm --use-crossfade-fix
```

### Bad Display Aspect Ratio

[This video](https://cdn.media.ccc.de/events/gpn/gpn16/h264-sd/gpn16-7623-deu-Wie_baut_man_eigentlich_Raumschiffe_sd.mp4)
([from here](https://media.ccc.de/v/gpn16-7623-wie_baut_man_eigentlich_raumschiffe)) has a display aspect ratio of 16:9 (1.77)
but a natural resolution of 720x576 (1.25). Create images(1024x576) with square pixels like this:

```shell
wget "https://cdn.media.ccc.de/events/gpn/gpn16/h264-sd/gpn16-7623-deu-Wie_baut_man_eigentlich_Raumschiffe_sd.mp4" -o baddar.mp4
npx chaptertool@latest generate baddar.mp4 --force-dar
```
