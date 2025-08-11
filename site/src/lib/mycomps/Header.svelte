<script>
  import Button from "$lib/components/ui/button/button.svelte";
  import { Github } from "lucide-svelte";
</script>

<div class="flex items-center justify-between">
  <div class="flex gap-2 items-center">
    <img src="/logo.svg" alt="VideoRecall" class="h-12" />
    <p class="text-xl md:text-4xl">VideoRecall</p>
  </div>
  <div>
    <Button variant="outline" class="flex items-center gap-1">
      <Github />
      <span>GitHub</span>
    </Button>
  </div>
</div>
