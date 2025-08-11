<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";

  let { name = "" }: { name: string } = $props();

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

<div class="flex flex-col gap-4">
  <div class="flex flex-wrap gap-4">
    {#each browsers as b (b.name)}
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
    {/each}
  </div>
</div>
