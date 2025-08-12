<script>
  import Button from "$lib/components/ui/button/button.svelte";
  import { Github } from "lucide-svelte";
</script>

<div class="flex items-center justify-between">
  <a href="/" class="flex gap-2 items-center">
    <img src="/logo.svg" alt="VideoRecall" class="h-12" />
    <p class="text-xl md:text-2xl font-medium">VideoRecall</p>
  </a>
  <div>
    <a href="https://github.com/HavitOngit/VideoRecall">
      <Button variant="outline" class="flex items-center gap-1">
        <Github />
        <span>GitHub</span>
      </Button>
    </a>
  </div>
</div>
