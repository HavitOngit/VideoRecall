<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { storeLinks } from "./storelinks";

  let { name = "both" } = $props();
  interface Browser {
    name: string;
    ptext: string;
    stext: string;
    logo: string;
    colors: string;
    href: string;
  }

  const browsers: Browser[] = [
    {
      name: "Chrome",
      ptext: "Available in",
      stext: "Chrome Web Store",
      logo: "/images/chrome.png",
      colors: "bg-white hover:bg-gray-300 border border-gray-300 text-gray-600",
      href: storeLinks.chrome,
    },
    {
      name: "Firefox",
      ptext: "GET THE",
      stext: "ADD-ONS",
      logo: "/images/firefox.png",
      colors: "bg-black hover:bg-gray-800 text-white",
      href: storeLinks.firefox,
    },
    {
      name: "Opera",
      ptext: "GET THE",
      stext: "ADD-ONS",
      logo: "/images/opera.png",
      colors: "bg-black hover:bg-gray-800 text-white",
      href: storeLinks.opera,
    },
  ];

  function handleClick(name: string) {
    window.open(name, "_blank");
  }
</script>

{#snippet StoreButton(b: Browser)}
  <Button
    class={`${b.colors} font-medium px-6 py-7 mb-2 rounded-lg flex items-center gap-3 hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl`}
    onclick={() => handleClick(b.href)}
  >
    <img
      src={b.logo}
      alt={`${b.name} logo`}
      width="38"
      height="38"
      class="rounded-sm"
      onerror={(e) =>
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
{:else if name === "Opera"}
  {@render StoreButton(browsers[2])}
{:else}
  {@render StoreButton(browsers[0])}
  {@render StoreButton(browsers[1])}
{/if}
