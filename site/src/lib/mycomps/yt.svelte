<script lang="ts">
  let vid: HTMLVideoElement;
  let sentinel: HTMLDivElement;

  // Undo/Redo stacks
  let undoStack: Array<{ from: number; to: number }> = $state([]);
  let redoStack: Array<{ from: number; to: number }> = $state([]);
  let lastTime = 0;
  let ignoreNextJump = false;
  let tracker: NodeJS.Timeout;

  function handleKeyDown(event: KeyboardEvent) {
    if (event.ctrlKey) {
      switch (event.key) {
        case "z":
          undo();
          event.preventDefault();
          break;
        case "y":
          redo();
          event.preventDefault();
          break;
      }
    }
  }

  function undo() {
    const nextAction = undoStack.pop();
    if (nextAction) {
      redoStack.push(nextAction);
      ignoreNextJump = true;

      if (document.documentElement.hasAttribute("data-video-recall-installed"))
        return;

      vid.currentTime = nextAction.from;
      console.log(
        `↩️ Undo seek → Back to ${(nextAction.from / 60).toFixed(
          2
        )} min (was ${(nextAction.to / 60).toFixed(2)} min)`
      );
    }
  }

  function redo() {
    const nextAction = redoStack.pop();
    if (nextAction) {
      undoStack.push(nextAction);
      ignoreNextJump = true;
      if (document.documentElement.hasAttribute("data-video-recall-installed"))
        return;

      vid.currentTime = nextAction.to;
      console.log(
        `↪️ Redo seek → Forward to ${(nextAction.to / 60).toFixed(
          2
        )} min (was ${(nextAction.from / 60).toFixed(2)} min)`
      );
    }
  }

  function startTracking() {
    if (tracker) clearInterval(tracker);

    lastTime = vid.currentTime;

    // Track seek jumps
    tracker = setInterval(() => {
      const curTime = vid.currentTime;
      const diff = Math.abs(curTime - lastTime);

      if (diff > 5 && !ignoreNextJump) {
        const jump = { from: lastTime, to: curTime };

        undoStack.push(jump);
        redoStack.length = 0; // Clear redo stack on new action

        if (undoStack.length > 200) {
          undoStack.shift(); // Limit stack size
        }

        console.log("Stack length: " + undoStack.length);
        console.log(
          `⏩ Jump detected! From ${(jump.from / 60).toFixed(2)} min to ${(
            jump.to / 60
          ).toFixed(2)} min`
        );
      }

      ignoreNextJump = false;
      lastTime = curTime;
    }, 500);
  }

  function handOffFocus() {
    requestAnimationFrame(() => {
      sentinel?.focus();
    });
  }

  function onKey(e: KeyboardEvent) {
    if (e.code === "Space") {
      if (vid.paused) vid.play();
      else vid.pause();
      e.preventDefault();
    }
  }

  function onVideoLoaded() {
    startTracking();
  }

  function cleanup() {
    if (tracker) {
      clearInterval(tracker);
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

  document.addEventListener("keydown", handleKeyDown, { capture: true });
  document.addEventListener("keydown", onKey, { capture: true });

  // Cleanup on component destroy (if using Svelte)
  // onDestroy(cleanup);
</script>

<div class="player">
  <video
    bind:this={vid}
    src="/demo.mp4"
    class="video-js vjs-theme-city"
    controls
    tabindex="0"
    onclick={handOffFocus}
    onplay={handOffFocus}
    onloadeddata={onVideoLoaded}
  ></video>

  <div class="flex gap-10">
    {#if undoStack.length > 0}
      <div>
        <p>undoStack</p>
        <ul>
          {#each undoStack as action}
            <li>
              {richNum(action.from)} - {richNum(action.to)}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if redoStack.length > 0}
      <div>
        <p>redoStack</p>
        <ul>
          {#each redoStack as action}
            <li>
              {richNum(action.from)} - {richNum(action.to)}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <!-- Hidden focus sink -->
  <div
    bind:this={sentinel}
    tabindex="-1"
    aria-hidden="true"
    style="position:absolute; width:0; height:0; overflow:hidden; outline:none;"
  ></div>
</div>
