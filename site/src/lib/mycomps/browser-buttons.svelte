<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";

  interface Browser {
    name: string;
    logo: string;
    colors: string;
  }

  const browsers: Browser[] = [
    {
      name: "Edge",
      logo: "/images/edge.png",
      colors:
        "bg-gradient-to-r from-blue-600 via-cyan-500 to-green-500 hover:from-blue-700 hover:via-cyan-600 hover:to-green-600",
    },
    {
      name: "Brave",
      logo: "/images/brave.png",
      colors:
        "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700",
    },
    {
      name: "Zen",
      logo: "/images/zen.png",
      colors:
        "bg-gradient-to-r from-gray-800 to-gray-600 hover:from-gray-900 hover:to-gray-700",
    },
  ];

  function handleClick(name: string) {
    console.log(`Downloading for ${name}`);
  }
</script>

{#snippet BrowserButton(b: Browser)}
  <Button
    class={`${b.colors} text-white font-medium px-6 py-4 rounded-lg flex items-center gap-3 hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl`}
    onclick={() => handleClick(b.name)}
  >
    <img
      src={b.logo}
      alt={`${b.name} logo`}
      width="24"
      height="24"
      class="rounded-sm"
      on:error={(e) =>
        e.currentTarget instanceof HTMLImageElement &&
        (e.currentTarget.src = "/vite.svg")}
    />
    <span>Add to {b.name}</span>
  </Button>
{/snippet}
