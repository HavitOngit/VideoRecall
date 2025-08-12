<script lang="ts">
  import Header from "$lib/mycomps/Header.svelte";
  import Intro from "$lib/mycomps/Intro.svelte";
  import BrowserButtons from "$lib/mycomps/browser-buttons.svelte";
  import Yt from "$lib/mycomps/yt.svelte";
  import "./app.css";
</script>

<main class="mx-auto mb-20 max-w-6xl pt-4 px-4 sm:px-6 md:px-8">
  <Header />
  <div class="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-4 pt-16">
    <div><Intro /></div>
    <div>
      <Yt />
    </div>
  </div>
</main>
