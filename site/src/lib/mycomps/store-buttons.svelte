<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { Store } from "lucide-svelte";

  let { name = "both" } = $props();
  interface Browser {
    name: string;
    ptext: string;
    stext: string;
    logo: string;
    colors: string;
  }

  const browsers: Browser[] = [
    {
      name: "Chrome",
      ptext: "Available in",
      stext: "Chrome Web Store",
      logo: "/images/chrome.png",
      colors: "bg-gray-500 hover:bg-gray-400",
    },
    {
      name: "Firefox",
      ptext: "GET THE",
      stext: "ADD-ONS",
      logo: "/images/firefox.png",
      colors: "bg-black hover:bg-gray-800",
    },
  ];

  function handleClick(name: string) {
    console.log(`Downloading for ${name}`);
  }
</script>

{#snippet StoreButton(b)}
  <Button
    class={`${b.colors} text-white font-medium px-6 py-7 rounded-lg flex items-center gap-3 hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl`}
    onclick={() => handleClick(b.name)}
  >
    <img
      src={b.logo}
      alt={`${b.name} logo`}
      width="38"
      height="38"
      class="rounded-sm"
      on:error={(e) =>
        e.currentTarget instanceof HTMLImageElement &&
        (e.currentTarget.src = "/vite.svg")}
    />
    <div class="flex flex-col gap-0 text-left">
      <span>{b.ptext}</span>
      <span class="font-bold text-lg">{b.stext}</span>
    </div>
  </Button>
{/snippet}

{#if name === "Chrome"}
  {@render StoreButton(browsers[0])}
{:else if name === "Firefox"}
  {@render StoreButton(browsers[1])}
{:else}
  {@render StoreButton(browsers[0])}
  {@render StoreButton(browsers[1])}
{/if}
