<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import videojs from "video.js";
  import "video.js/dist/video-js.css";
  // DASH support
  import "videojs-contrib-dash";
  import type Player from "video.js/dist/types/player";

  // Underlying video element ref for Video.js
  let videoEl: HTMLVideoElement;
  let player: Player;

  // Undo/Redo stacks & jump tracking (retain original behavior)
  let undoStack = $state<Array<{ from: number; to: number }>>([]);
  let redoStack = $state<Array<{ from: number; to: number }>>([]);
  let lastTime = 0;
  let ignoreNextJump = false; // prevents tracking programmatic jump
  let tracker: number | null = null; // interval id

  // Playback state (for any future UI you may add back)
  let currentTime = $state(0);
  let duration = $state(0);
  let paused = $state(true);

  const SEEK_THRESHOLD = 5; // seconds to consider a jump
  const MAX_STACK = 200;

  function undo() {
    const next = undoStack.pop();
    if (next && player) {
      redoStack.push(next);
      ignoreNextJump = true;
      player.currentTime(next.from);
      console.log(`↩️ Undo seek → ${(next.from / 60).toFixed(2)} min`);
    }
  }

  function redo() {
    const next = redoStack.pop();
    if (next && player) {
      undoStack.push(next);
      ignoreNextJump = true;
      player.currentTime(next.to);
      console.log(`↪️ Redo seek → ${(next.to / 60).toFixed(2)} min`);
    }
  }

  function startTracking() {
    stopTracking();
    lastTime = player?.currentTime() || 0;
    tracker = window.setInterval(() => {
      if (!player) return;
      const cur = player.currentTime() ?? lastTime;
      const diff = Math.abs(cur - lastTime);
      if (diff > SEEK_THRESHOLD && !ignoreNextJump) {
        const jump: { from: number; to: number } = { from: lastTime, to: cur };
        undoStack.push(jump);
        if (redoStack.length) redoStack.length = 0; // clear redo on new branch
        if (undoStack.length > MAX_STACK) undoStack.shift();
        console.log(
          `⏩ Jump: ${(jump.from / 60).toFixed(2)} → ${(jump.to / 60).toFixed(2)} min`
        );
      }
      ignoreNextJump = false;
      lastTime = cur;
    }, 500);
  }

  function stopTracking() {
    if (tracker) {
      clearInterval(tracker);
      tracker = null;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (!player) return;
    if (e.ctrlKey && e.key === "z") {
      undo();
      e.preventDefault();
      return;
    }
    if (e.ctrlKey && e.key === "y") {
      redo();
      e.preventDefault();
      return;
    }
    switch (e.code) {
      case "ArrowRight":
        player.currentTime((player.currentTime() ?? 0) + 5);
        e.preventDefault();
        break;
      case "ArrowLeft":
        player.currentTime((player.currentTime() ?? 0) - 5);
        e.preventDefault();
        break;
      case "Space":
        if (player.paused()) player.play();
        else player.pause();
        e.preventDefault();
        break;
    }
  }

  function richNum(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  const DASH_SRC =
    "https://customer-bsnaxhlfalb3pe52.cloudflarestream.com/fc5631ba4df61cb07083e20aa3e4ba18/manifest/video.mpd";

  onMount(() => {
    // Initialize Video.js
    player = videojs(videoEl, {
      controls: true,
      fluid: true,
      preload: "auto",
      html5: {
        vhs: {
          overrideNative: true,
        },
      },
      sources: [
        {
          src: DASH_SRC,
          type: "application/dash+xml",
        },
      ],
    });

    player.on("loadedmetadata", () => {
      duration = player.duration() || 0;
      currentTime = player.currentTime() ?? 0;
      startTracking();
    });
    player.on("timeupdate", () => {
      currentTime = player.currentTime() ?? 0;
    });
    player.on("durationchange", () => {
      duration = player.duration() || 0;
    });
    player.on("play", () => {
      paused = false;
    });
    player.on("pause", () => {
      paused = true;
    });

    document.addEventListener("keydown", onKey, { capture: true });

    return () => {
      document.removeEventListener("keydown", onKey, { capture: true } as any);
    };
  });

  onDestroy(() => {
    stopTracking();
    if (player) player.dispose();
  });
</script>

<div class="video-wrapper">
  <video
    bind:this={videoEl}
    id="player"
    class="video-js vjs-default-skin vjs-big-play-centered"
    playsinline
  ></video>
</div>

{#if undoStack.length == 0 && redoStack.length == 0}
  <p class="text-right hint">
    Try to Seek the video to see in Action and press Ctrl+Z / Ctrl+Y.
  </p>
{/if}

{#if undoStack.length > 0 || redoStack.length > 0}
  <div class="history-stacks">
    {#if undoStack.length > 0}
      <div>
        <p class="stack-title">undoStack</p>
        <ul>
          {#each undoStack as action}
            <li>{richNum(action.from)} - {richNum(action.to)}</li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if redoStack.length > 0}
      <div>
        <p class="stack-title">redoStack</p>
        <ul>
          {#each redoStack as action}
            <li>{richNum(action.from)} - {richNum(action.to)}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}

<style>
  .video-wrapper {
    max-width: 960px;
    margin: 0 auto;
  }
  .history-stacks {
    max-width: 960px;
    margin: 0.75rem auto;
    display: flex;
    gap: 2rem;
    font-family: system-ui, sans-serif;
    font-size: 12px;
    color: #222;
  }
  .history-stacks ul {
    list-style: none;
    padding: 0;
    margin: 0.25rem 0 0;
    max-height: 160px;
    overflow: auto;
    background: #f7f7f7;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 4px 6px;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .history-stacks ul::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
  .history-stacks li {
    line-height: 1.2;
    white-space: nowrap;
    font-family: ui-monospace, monospace;
  }
  .stack-title {
    font-weight: 600;
    margin: 0;
  }
  .hint {
    font:
      12px system-ui,
      sans-serif;
    max-width: 960px;
    margin: 0.75rem auto;
    color: #444;
  }
</style>
