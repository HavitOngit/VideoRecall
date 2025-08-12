<script lang="ts">
  import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize,
    Minimize,
  } from "lucide-svelte";
  let vid = $state<HTMLVideoElement>();
  let sentinel: HTMLDivElement;
  let playerEl: HTMLDivElement;

  // Undo/Redo stacks & jump tracking
  let undoStack = $state<Array<{ from: number; to: number }>>([]);
  let redoStack = $state<Array<{ from: number; to: number }>>([]);
  let lastTime = 0;
  let ignoreNextJump = false; // prevents tracking the programmatic jump caused by undo/redo
  let tracker: NodeJS.Timeout; // interval id

  // Playback state (runes)
  let currentTime = $state(0);
  let duration = $state(0);
  let isScrubbing = $state(false); // not shown in UI now, but rune in case future UI reflects it
  let wasPausedForScrub = false; // internal only
  let volume = $state(1);
  let muted = $state(false);
  let isFullscreen = $state(false);
  let hoverTime = $state<number | null>(null);
  let hoverX = $state(0);
  let paused = $state(true);

  const progress = $derived(duration ? currentTime / duration : 0);

  // ===================== Undo / Redo =====================
  function undo() {
    const nextAction = undoStack.pop();
    if (nextAction) {
      redoStack.push(nextAction);
      ignoreNextJump = true;
      if (
        !document.documentElement.hasAttribute("data-video-recall-installed")
      ) {
        vid.currentTime = nextAction.from;
      }
      console.log(
        `↩️ Undo seek → Back to ${(nextAction.from / 60).toFixed(2)} min (was ${(nextAction.to / 60).toFixed(2)} min)`
      );
    }
  }

  function redo() {
    const nextAction = redoStack.pop();
    if (nextAction) {
      undoStack.push(nextAction);
      ignoreNextJump = true;
      if (
        !document.documentElement.hasAttribute("data-video-recall-installed")
      ) {
        vid.currentTime = nextAction.to;
      }
      console.log(
        `↪️ Redo seek → Forward to ${(nextAction.to / 60).toFixed(2)} min (was ${(nextAction.from / 60).toFixed(2)} min)`
      );
    }
  }

  function startTracking() {
    if (tracker) clearInterval(tracker);
    lastTime = vid?.currentTime || 0;
    tracker = setInterval(() => {
      if (!vid) return;
      const curTime = vid.currentTime;
      const diff = Math.abs(curTime - lastTime);
      // treat a jump larger than 5s as a seek action we can undo/redo
      if (diff > 5 && !ignoreNextJump) {
        const jump = { from: lastTime, to: curTime };
        undoStack.push(jump);
        // Clear redo stack because we've created a new branch of history
        if (redoStack.length) redoStack.length = 0;
        // Limit stack size
        if (undoStack.length > 200) undoStack.shift();
        console.log("Stack length: " + undoStack.length);
        console.log(
          `⏩ Jump detected! From ${(jump.from / 60).toFixed(2)} min to ${(jump.to / 60).toFixed(2)} min`
        );
      }
      ignoreNextJump = false;
      lastTime = curTime;
    }, 500) as any;
  }

  function handOffFocus() {
    requestAnimationFrame(() => {
      sentinel?.focus();
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey) {
      if (e.key === "z") {
        undo();
        e.preventDefault();
        return;
      }
      if (e.key === "y") {
        redo();
        e.preventDefault();
        return;
      }
    }
    switch (e.code) {
      case "Space":
        togglePlay();
        e.preventDefault();
        break;
      case "ArrowRight":
        seekTo(vid.currentTime + 5);
        e.preventDefault();
        break;
      case "ArrowLeft":
        seekTo(vid.currentTime - 5);
        e.preventDefault();
        break;
    }
  }

  function onVideoLoaded() {
    duration = vid.duration || 0;
    currentTime = vid.currentTime;
    startTracking();
  }

  function cleanup() {
    document.removeEventListener("keydown", onKey, { capture: true } as any);
    document.removeEventListener("keydown", onKey, { capture: true } as any);
    document.removeEventListener("pointermove", onGlobalPointerMove);
    document.removeEventListener("pointerup", onGlobalPointerUp);
    document.removeEventListener("fullscreenchange", onFsChange);
    if (tracker) clearInterval(tracker);
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

  function togglePlay() {
    if (!vid) return;
    if (vid.paused) vid.play();
    else vid.pause();
  }

  function onPlay() {
    paused = false;
  }
  function onPause() {
    paused = true;
  }

  function toggleMute() {
    muted = !muted;
    vid.muted = muted;
  }

  function onVolume() {
    vid.volume = volume;
    if (vid.volume === 0) {
      muted = true;
      vid.muted = true;
    } else {
      muted = false;
      vid.muted = false;
    }
  }

  function seekTo(t: number) {
    t = Math.min(Math.max(0, t), duration || 0);
    vid.currentTime = t;
  }

  function onTimeUpdate() {
    currentTime = vid.currentTime;
  }

  function onDurationChange() {
    duration = vid.duration || 0;
  }

  function pctFromEvent(e: PointerEvent | MouseEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    return rect.width ? x / rect.width : 0;
  }

  function onProgressClick(e: MouseEvent) {
    const wrapper = e.currentTarget as HTMLElement;
    const pct = pctFromEvent(e, wrapper);
    seekTo(pct * duration);
  }

  function onScrubStart(e: PointerEvent) {
    const wrapper = e.currentTarget as HTMLElement;
    isScrubbing = true;
    wasPausedForScrub = vid.paused;
    vid.pause();
    updateScrub(e, wrapper);
    document.addEventListener("pointermove", onGlobalPointerMove);
    document.addEventListener("pointerup", onGlobalPointerUp);
  }

  function onGlobalPointerMove(e: PointerEvent) {
    if (!isScrubbing) return;
    const wrapper = playerEl.querySelector(".progress-wrapper") as HTMLElement;
    if (wrapper) updateScrub(e, wrapper);
  }

  function updateScrub(e: PointerEvent, wrapper: HTMLElement) {
    const pct = pctFromEvent(e, wrapper);
    seekTo(pct * duration);
  }

  function onGlobalPointerUp() {
    if (isScrubbing) {
      isScrubbing = false;
      if (!wasPausedForScrub) vid.play();
    }
    document.removeEventListener("pointermove", onGlobalPointerMove);
    document.removeEventListener("pointerup", onGlobalPointerUp);
  }

  function onProgressMove(e: MouseEvent) {
    const wrapper = e.currentTarget as HTMLElement;
    const rect = wrapper.getBoundingClientRect();
    hoverX = e.clientX - rect.left;
    const pct = pctFromEvent(e, wrapper);
    hoverTime = pct * duration;
  }

  function clearHover() {
    hoverTime = null;
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      playerEl.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  function onFsChange() {
    isFullscreen = !!document.fullscreenElement;
  }

  document.addEventListener("keydown", onKey, { capture: true });
  document.addEventListener("fullscreenchange", onFsChange);

  // (Optional) onDestroy(cleanup);
</script>

<div class="player {isFullscreen ? 'is-fullscreen' : ''}" bind:this={playerEl}>
  <video
    bind:this={vid}
    src="/demo.mp4"
    tabindex="0"
    onclick={handOffFocus}
    onplay={handOffFocus}
    onplaycapture={onPlay}
    onpausecapture={onPause}
    onloadeddata={onVideoLoaded}
    ontimeupdate={onTimeUpdate}
    ondurationchange={onDurationChange}
    playsinline
  >
    <!-- Placeholder captions track to satisfy a11y; replace src with real VTT if available -->
    <track kind="captions" label="English" srclang="en" default />
  </video>

  <div
    class="controls {isFullscreen ? 'in-fs' : ''}"
    role="group"
    aria-label="Video controls"
    ondblclick={toggleFullscreen}
  >
    <div class="row">
      <button
        class="btn"
        onclick={togglePlay}
        aria-label={vid?.paused ? "Play" : "Pause"}
      >
        {#if paused}
          <Play size={18} />
        {:else}
          <Pause size={18} />
        {/if}
      </button>

      <div
        class="progress-wrapper"
        onclick={onProgressClick}
        onpointerdown={onScrubStart}
        onmousemove={onProgressMove}
        onmouseleave={clearHover}
        aria-label="Seek"
        role="slider"
        aria-valuemin="0"
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(currentTime)}
        tabindex="0"
        onkeydown={(e) => {
          if (e.key === "ArrowLeft") {
            seekTo(currentTime - 5);
            e.preventDefault();
          }
          if (e.key === "ArrowRight") {
            seekTo(currentTime + 5);
            e.preventDefault();
          }
        }}
      >
        <div class="progress-bar">
          <div class="progress-fill" style="width:{progress * 100}%;"></div>
          <div class="progress-handle" style="left:{progress * 100}%;"></div>
          {#if hoverTime !== null}
            <div class="hover-time" style="left:{hoverX}px;">
              {richNum(hoverTime)}
            </div>
          {/if}
        </div>
      </div>

      <div class="time">
        {richNum(currentTime)} / {richNum(duration)}
      </div>

      <!-- Volume group with hover slider -->
      <div class="volume-group">
        <button
          class="btn icon"
          onclick={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {#if muted || volume === 0}
            <VolumeX size={18} />
          {:else}
            <Volume2 size={18} />
          {/if}
        </button>
        <input
          class="vol volume-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={volume}
          oninput={onVolume}
          aria-label="Volume"
        />
      </div>

      <button
        class="btn icon"
        onclick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {#if isFullscreen}
          <Minimize size={18} />
        {:else}
          <Maximize size={18} />
        {/if}
      </button>
    </div>
  </div>
</div>

{#if undoStack.length == 0 && redoStack.length == 0}
  <p class="text-right">Try to seek this video</p>
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

<!-- Hidden focus sink -->
<div
  bind:this={sentinel}
  tabindex="-1"
  aria-hidden="true"
  style="position:absolute; width:0; height:0; overflow:hidden; outline:none;"
></div>

<!-- merged history-stacks styles into primary style block above to comply with single style requirement -->

<style>
  .player {
    position: relative;
    background: #000;
    max-width: 960px;
    margin: 0 auto;
    font-family: system-ui, sans-serif;
    user-select: none;
    overflow: hidden; /* prevent accidental horizontal scroll if children overflow */
  }
  video {
    width: 100%;
    display: block;
    background: #000;
  }
  .controls {
    position: absolute;
    inset: auto 0 0 0;
    padding: 0.5rem 0.75rem 0.75rem;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0));
    opacity: 1;
    transition: opacity 0.25s;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    box-sizing: border-box;
    width: 100%; /* ensure controls never exceed player width */
  }
  .player:not(:hover) .controls {
    opacity: 0;
  }
  .player.is-fullscreen:not(:hover) .controls {
    opacity: 0;
  }
  .player.is-fullscreen {
    width: 100%;
    height: 100%;
  }
  .player.is-fullscreen video {
    height: 100%;
    object-fit: contain;
  }
  .controls.in-fs {
    font-size: clamp(12px, 1.6vh, 14px);
  }
  .controls.in-fs .btn {
    font-size: inherit;
  }
  .player.is-fullscreen .controls {
    flex-wrap: nowrap;
  }
  .player.is-fullscreen .row {
    flex-wrap: nowrap;
  }
  @media (max-height: 560px) {
    .player.is-fullscreen .time {
      display: none;
    }
    .player.is-fullscreen .controls {
      padding: 0.35rem 0.5rem 0.5rem;
    }
    .player.is-fullscreen .progress-wrapper {
      height: 14px;
    }
    .player.is-fullscreen .progress-handle {
      width: 12px;
      height: 12px;
    }
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    width: 100%;
    min-width: 0; /* allow flex children to shrink */
  }
  .btn {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border: none;
    padding: 0.4rem 0.6rem;
    border-radius: 0.35rem;
    font-size: 0.85rem;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }
  .btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .btn.icon {
    padding: 0.4rem;
  }
  .time {
    font-size: 0.75rem;
    color: #eee;
    white-space: nowrap;
  }
  .progress-wrapper {
    flex: 1;
    height: 20px;
    position: relative;
    cursor: pointer;
    display: flex;
    align-items: center;
    min-width: 0; /* prevent overflow from intrinsic min-width of content */
  }
  .progress-bar {
    position: relative;
    width: 100%;
    height: 6px;
    background: #444;
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #fff;
    width: 0;
    pointer-events: none;
  }
  .progress-handle {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 9px;
    height: 14px;
    background: #be1b1b;
    border-radius: 50%; /* 50% is the standard for perfect circles */
    box-shadow:
      0 0 0 2px rgba(0, 0, 0, 0.45),
      0 0 4px rgba(255, 255, 255, 0.5);
    pointer-events: none;
  }
  .progress-wrapper:hover .progress-handle,
  .progress-wrapper:focus .progress-handle {
    transform: translate(-50%, -50%) scale(1.15);
  }

  .hover-time {
    position: absolute;
    top: -26px;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    font-size: 0.6rem;
    padding: 2px 4px;
    border-radius: 3px;
    pointer-events: none;
    white-space: nowrap;
  }
  .volume-group {
    position: relative;
    display: flex;
    align-items: center;
    flex: 0 0 auto; /* don't let volume group steal flexible space beyond content */
  }
  .vol {
    accent-color: #fff;
  }
  .volume-slider {
    width: 0;
    opacity: 0;
    margin-left: 0.3rem;
    transition:
      width 0.25s ease,
      opacity 0.25s ease;
    pointer-events: none;
  }
  .volume-group:hover .volume-slider,
  .volume-group:focus-within .volume-slider {
    width: 90px;
    opacity: 1;
    pointer-events: auto;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  /* Media queries */
  @media (max-width: 600px) {
    .controls {
      flex-direction: row;
      flex-wrap: nowrap;
      padding: 0.5rem 0.5rem 0.6rem;
    }
    .row {
      width: 100%;
      justify-content: flex-start;
      gap: 0.45rem;
    }
    /* Keep buttons intrinsic so progress bar can grow */
    .btn {
      flex: 0 0 auto;
      margin: 0;
    }
    /* Hide expanding volume slider entirely on small screens */
    .volume-slider,
    .volume-group:hover .volume-slider,
    .volume-group:focus-within .volume-slider,
    .vol {
      display: none !important;
      width: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    /* Give progress bar priority */
    .progress-wrapper {
      flex: 1 1 auto;
    }
    /* Optionally shrink time or hide if super tight */
    @media (max-width: 430px) {
      .time {
        display: none;
      }
    }
  }
  @media (max-width: 400px) {
    .btn {
      font-size: 0.8rem;
      padding: 0.3rem 0.5rem;
    }
  }
  /* Undo/redo history stacks */
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
    /* Hide scrollbar Firefox */
    scrollbar-width: none;
    /* Hide scrollbar IE/Edge */
    -ms-overflow-style: none;
  }
  /* Hide scrollbar WebKit */
  .history-stacks ul::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
  .history-stacks ul::-webkit-scrollbar-track {
    background: transparent;
  }
  .history-stacks ul::-webkit-scrollbar-thumb {
    background: transparent;
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
</style>
