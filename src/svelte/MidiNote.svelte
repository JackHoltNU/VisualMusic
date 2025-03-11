<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  
  // Props
  export let name: string;
  export let velocity: number;
  export let timestamp: number;
  export let fadeDuration: number = 3000;
  export let inKey: boolean = true; // Whether the note is in the detected key
  
  // State
  let opacity: number = 1;
  let animationFrame: number;
  
  const dispatch = createEventDispatcher();
  
  function updateOpacity() {
    const now = Date.now();
    const elapsed = now - timestamp;
    
    if (elapsed < fadeDuration) {
      opacity = Math.max(0, 1 - (elapsed / fadeDuration));
      animationFrame = requestAnimationFrame(updateOpacity);
    } else {
      opacity = 0;
      dispatch('fadeComplete');
    }
  }
  
  onMount(() => {
    console.log(`MidiNote mounted: ${name}, in key: ${inKey}`);
    animationFrame = requestAnimationFrame(updateOpacity);
  });
  
  onDestroy(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  });
</script>

<div 
  class="note" 
  class:in-key={inKey} 
  class:accidental={!inKey}
  style="opacity: {opacity};"
>
  {name}
</div>

<style>
  .note {
    display: inline-block;
    padding: 12px 18px;
    border-radius: 4px;
    font-size: 16px;
    font-weight: bold;
    transition: opacity 0.1s ease, background-color 0.3s ease;
  }
  
  .in-key {
    background-color: #4CAF50;
    color: white;
  }
  
  .accidental {
    background-color: #F44336;
    color: white;
  }
</style>