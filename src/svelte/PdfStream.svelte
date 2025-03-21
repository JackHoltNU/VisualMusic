<!-- src/svelte/PdfStream.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import PdfViewer from './PdfViewer.svelte';
  import PdfSelector from './PdfSelector.svelte';
  import { getControllerService } from './services/ControllerService';
  
  // Props
  export let midiInputId: string = '';
  
  // State
  let selectedPdf: { path: string; name: string } | null = null;
  let viewerComponent: PdfViewer;
  let showSelector: boolean = true;
  let viewerSettings = {
    pagesPerView: 1,
    isFullscreen: false
  };
  
  // Controller service
  let controllerService = getControllerService();
  
  // Handle file selection
  function handlePdfSelect(event: CustomEvent) {
    const { path, name } = event.detail;
    selectedPdf = { path, name };
    showSelector = false;
    
    // Load PDF in viewer
    if (viewerComponent) {
      viewerComponent.openPdf(path);
    }
  }
  
  // Toggle back to selector
  function backToSelector() {
    showSelector = true;
  }
  
  // Setup controller events
  function setupControllerEvents() {
    // Use A button to go back to selector when in viewer
    controllerService.addEventListener('button_a', () => {
      if (!showSelector) {
        backToSelector();
      }
    }); 
  }
  
  onMount(() => {
    setupControllerEvents();
  });
  
  onDestroy(() => {
    // Clean up controller events
    controllerService.removeEventListener('button_a', () => {});
  });
</script>

<div class="pdf-stream">
<div class="header">
  <h2>Sheet Music</h2>
  {#if selectedPdf && !showSelector}
    <div class="current-file">
      <span class="file-name">{selectedPdf.name}</span>
      <button class="change-button" on:click={backToSelector}>
        Change File {controllerService.isConnected ? '(A)' : ''}
      </button>
    </div>
  {/if}
</div>

<div class="content">
  {#if showSelector}
    <PdfSelector on:select={handlePdfSelect} />
  {:else}
    <PdfViewer 
      bind:this={viewerComponent} 
      pdfPath={selectedPdf?.path || ''} 
      midiInputId={midiInputId} 
    />
  {/if}
</div>
</div>

<style>
.pdf-stream {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
  color: #ffffff;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background-color: #333;
  border-bottom: 1px solid #444;
  z-index: 10;
}

h2 {
  margin: 0;
  font-size: 18px;
  color: #4CAF50;
}

.current-file {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-name {
  font-weight: bold;
  color: #ccc;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.change-button {
  padding: 4px 8px;
  background-color: #555;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.change-button:hover {
  background-color: #666;
}

.content {
  flex: 1;
  overflow: hidden;
}
</style>