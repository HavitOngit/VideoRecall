(function () {
  let activeVideo = null;
  let videoStacks = new WeakMap();
  let lastUrl = location.href;

  function isSeekable(video) {
    return (
      video.seekable.length > 0 && video.duration && video.duration !== Infinity
    );
  }

  // Fallback: search through open shadow roots only if regular DOM search finds no videos
  function findAllVideos(root = document, found = new Set()) {
    // Normal DOM first (this also runs for shadow root contents when recursing)
    root.querySelectorAll("video").forEach((v) => found.add(v));

    // Recurse into open shadow roots
    root.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) {
        findAllVideos(el.shadowRoot, found);
      }
    });

    return Array.from(found);
  }

  function setActiveVideo(video) {
    activeVideo = video;
    console.log("🎥 Active video switched:", video);
  }

  function trackVideo(video) {
    if (videoStacks.has(video)) return;
    if (!isSeekable(video)) {
      console.log("⏭️ Skipping unseekable video");
      return;
    }

    videoStacks.set(video, {
      undoStack: [],
      redoStack: [],
      lastTime: video.currentTime,
      ignoreNextJump: false,
    });

    // If already playing when found, set as active
    if (!video.paused && !video.ended) {
      setActiveVideo(video);
    }

    // Detect when playback starts
    video.addEventListener("playing", () => {
      if (activeVideo !== video) {
        setActiveVideo(video);
      }
    });

    // Track seek jumps
    setInterval(() => {
      const stacks = videoStacks.get(video);
      if (!stacks) return;

      const curTime = video.currentTime;
      const diff = Math.abs(curTime - stacks.lastTime);

      if (diff > 5 && video === activeVideo && !stacks.ignoreNextJump) {
        const jump = { from: stacks.lastTime, to: curTime };

        stacks.undoStack.push(jump);
        stacks.redoStack.length = 0;

        console.log(
          `⏩ Jump detected! From ${(jump.from / 60).toFixed(2)} min to ${(
            jump.to / 60
          ).toFixed(2)} min`
        );
      }

      stacks.ignoreNextJump = false;
      stacks.lastTime = curTime;
    }, 500);
  }

  // Persistent video finder
  function findPlayingVideo() {
    // Try normal DOM first
    let videos = [...document.querySelectorAll("video")];
    if (videos.length === 0) {
      videos = findAllVideos();
      if (videos.length) {
        console.log("🔍 Using shadow DOM fallback to locate videos");
      }
    }
    return videos.find((v) => !v.paused && !v.ended && v.readyState > 2);
  }

  function observeVideos() {
    const tryFind = () => {
      const video = findPlayingVideo();
      if (video) {
        trackVideo(video);
      }
    };

    // Initial check
    tryFind();

    // Watch DOM for new videos
    const observer = new MutationObserver(() => {
      let vids = document.querySelectorAll("video");
      if (vids.length === 0) {
        const shadowVids = findAllVideos();
        if (shadowVids.length) {
          console.log(
            "🔍 Mutation fallback: shadow DOM videos discovered",
            shadowVids.length
          );
        }
        vids = shadowVids;
      }
      vids.forEach(trackVideo);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Undo
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "z" && activeVideo) {
      const stacks = videoStacks.get(activeVideo);
      if (!stacks) return;

      const lastAction = stacks.undoStack.pop();
      if (lastAction) {
        stacks.redoStack.push(lastAction);
        stacks.ignoreNextJump = true;
        activeVideo.currentTime = lastAction.from;
        console.log(
          `↩️ Undo seek → Back to ${(lastAction.from / 60).toFixed(
            2
          )} min (was ${(lastAction.to / 60).toFixed(2)} min)`
        );
      }
    }
  });

  // Redo
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "y" && activeVideo) {
      const stacks = videoStacks.get(activeVideo);
      if (!stacks) return;

      const nextAction = stacks.redoStack.pop();
      if (nextAction) {
        stacks.undoStack.push(nextAction);
        stacks.ignoreNextJump = true;
        activeVideo.currentTime = nextAction.to;
        console.log(
          `↪️ Redo seek → Forward to ${(nextAction.to / 60).toFixed(
            2
          )} min (was ${(nextAction.from / 60).toFixed(2)} min)`
        );
      }
    }
  });

  // SPA URL change watcher
  function watchUrlChanges() {
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        console.log("🔗 URL changed:", currentUrl);
        lastUrl = currentUrl;
        activeVideo = null;
        videoStacks = new WeakMap();
        observeVideos();
      }
    }).observe(document, { subtree: true, childList: true });
  }

  watchUrlChanges();
  observeVideos();
})();
