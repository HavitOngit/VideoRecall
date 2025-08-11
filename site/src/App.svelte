<script lang="ts">
  import Header from "$lib/mycomps/Header.svelte";
  import Intro from "$lib/mycomps/Intro.svelte";
  import BrowserButtons from "$lib/mycomps/browser-buttons.svelte";
  import Yt from "$lib/mycomps/yt.svelte";
  import "./app.css";
</script>

<main class="mx-10 w-fit md:mx-36 mt-6 gap-4 flex flex-col">
  <Header />
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-16">
    <div><Intro /></div>
    <div>
      <Yt />
    </div>
  </div>

  <BrowserButtons />
</main>
