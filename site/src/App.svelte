<script lang="ts">
  import Header from "$lib/mycomps/Header.svelte";
  import Intro from "$lib/mycomps/Intro.svelte";
  import { storeLinks } from "$lib/mycomps/storelinks";
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

<footer
  class="fixed inset-x-0 bottom-0 backdrop-blur text-[11px] sm:text-xs text-gray-700-200 text-center py-1 tracking-wide"
>
  suppots all
  <a href={storeLinks.chrome} target="_blank" class="underline"> Chromium </a>
  and

  <a href={storeLinks.firefox} target="_blank" class="underline">
    Firefox(Gecko)
  </a>
  based browesers
</footer>
