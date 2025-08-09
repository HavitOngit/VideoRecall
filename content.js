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
      const MAX_WAIT_MS = 15000; // fail-safe timeout
      let timeoutId;

      const cleanupWaiters = () => {
        video.removeEventListener("loadedmetadata", tryLater);
        video.removeEventListener("durationchange", tryLater);
        video.removeEventListener("canplay", tryLater);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const tryLater = () => {
        if (isSeekable(video)) {
          cleanupWaiters();
          console.log("✅ Video now seekable, tracking...");
          trackVideo(video); // retry
        }
      };

      video.addEventListener("loadedmetadata", tryLater);
      video.addEventListener("durationchange", tryLater);
      video.addEventListener("canplay", tryLater);

      timeoutId = setTimeout(() => {
        cleanupWaiters();
        console.log("⏱️ Timed out waiting for seekable video");
      }, MAX_WAIT_MS);

      console.log("⏳ Waiting for video to become seekable");
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
    const tracker = setInterval(() => {
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

    window.addEventListener("beforeunload", () => clearInterval(tracker));
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
    // More efficient than a broad DOM MutationObserver: hook History API + navigation events
    const triggerIfChanged = (reason) => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        console.log(`🔗 URL changed (${reason}):`, currentUrl);
        lastUrl = currentUrl;
        activeVideo = null;
        videoStacks = new WeakMap();
        observeVideos();
      }
    };

    // Debounce rapid successive triggers (some routers call pushState followed by replaceState)
    let debounceTimer = null;
    const scheduleCheck = (reason) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => triggerIfChanged(reason), 0);
    };

    // Patch pushState / replaceState to detect programmatic SPA navigations
    ["pushState", "replaceState"].forEach((method) => {
      const original = history[method];
      if (typeof original === "function") {
        history[method] = function (...args) {
          const ret = original.apply(this, args);
          scheduleCheck(method);
          return ret;
        };
      }
    });

    // Back/forward navigation
    window.addEventListener("popstate", () => scheduleCheck("popstate"));
    // Hash changes (some apps rely on # routing)
    window.addEventListener("hashchange", () => scheduleCheck("hashchange"));

    // Lightweight fallback polling (covers rare direct location.href assignments w/o events)
    const pollInterval = setInterval(() => triggerIfChanged("poll"), 1000);
    // Attempt cleanup when page unloads
    window.addEventListener("beforeunload", () => clearInterval(pollInterval));

    // Initial call
    triggerIfChanged("init");
  }

  watchUrlChanges();
  observeVideos();
})();
