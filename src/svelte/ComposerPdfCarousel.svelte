<!-- src/svelte/ComposerPdfCarousel.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { getControllerService, type GamepadEventType } from './services/ControllerService';
    
    export let recentFiles: {
      name: string;
      path: string;
      lastOpened: Date;
      annotation?: {
        title: string;
        composer: string;
        favorite: boolean;
        grade: number;
        previewUrl: string;
      }
    }[] = [];
    
    const dispatch = createEventDispatcher();
    const controllerService = getControllerService();
    
    // Carousel state
    let activeComposerIndex = 0;
    let activePdfIndex = 0;
    let focusedCarousel: 'composers' | 'pdfs' = 'composers';
    let composers: {name: string; count: number}[] = [];
    let composerPdfs: typeof recentFiles = [];
    
    // Animation settings
    const visibleItems = 5; // Number of items visible in each carousel
    const centerItemIndex = Math.floor(visibleItems / 2);
    
    // Update composers list based on the recentFiles
    $: {
      const composerMap = new Map<string, number>();
      
      // Count PDFs by composer
      recentFiles.forEach(file => {
        if (file.annotation?.composer) {
          const composer = file.annotation.composer.trim();
          if (composer) {
            composerMap.set(composer, (composerMap.get(composer) || 0) + 1);
          }
        }
      });
      
      // Convert to array and sort alphabetically
      composers = Array.from(composerMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Add "All" option at the top
      composers.unshift({ name: "All", count: recentFiles.length });
      
      // Update active composer if out of bounds
      if (activeComposerIndex >= composers.length) {
        activeComposerIndex = composers.length > 0 ? 0 : -1;
      }
      
      // Update PDFs for the active composer
      updateComposerPdfs();
    }
    
    // Update PDFs list when active composer changes
    function updateComposerPdfs() {
      if (composers.length === 0) {
        composerPdfs = [];
        return;
      }
      
      const selectedComposer = composers[activeComposerIndex]?.name;
      
      if (selectedComposer === "All") {
        composerPdfs = [...recentFiles];
      } else {
        composerPdfs = recentFiles.filter(file => 
          file.annotation?.composer?.trim() === selectedComposer
        );
      }
      
      // Reset active PDF index if out of bounds
      if (activePdfIndex >= composerPdfs.length) {
        activePdfIndex = composerPdfs.length > 0 ? 0 : -1;
      }
    }
    
    // Navigation functions
    function navigateUp() {
      if (focusedCarousel === 'composers') {
        activeComposerIndex = Math.max(0, activeComposerIndex - 1);
        updateComposerPdfs();
      } else {
        activePdfIndex = Math.max(0, activePdfIndex - 1);
      }
    }
    
    function navigateDown() {
      if (focusedCarousel === 'composers') {
        activeComposerIndex = Math.min(composers.length - 1, activeComposerIndex + 1);
        updateComposerPdfs();
      } else {
        activePdfIndex = Math.min(composerPdfs.length - 1, activePdfIndex + 1);
      }
    }
    
    function navigateLeft() {
      if (focusedCarousel === 'pdfs') {
        focusedCarousel = 'composers';
      }
    }
    
    function navigateRight() {
      if (focusedCarousel === 'composers' && composerPdfs.length > 0) {
        focusedCarousel = 'pdfs';
      }
    }
    
    function selectCurrentItem() {
      if (focusedCarousel === 'composers') {
        // Just update the PDFs list - already done in navigateUp/Down
      } else if (focusedCarousel === 'pdfs' && activePdfIndex >= 0 && activePdfIndex < composerPdfs.length) {
        // Select the PDF
        const selectedPdf = composerPdfs[activePdfIndex];
        dispatch('select', { path: selectedPdf.path, name: selectedPdf.name });
      }
    }
    
    // Calculate position and style for carousel items
    function getItemStyle(itemIndex: number, activeIndex: number) {
      // Calculate relative position to activeIndex (-2, -1, 0, 1, 2)
      const relativePosition = itemIndex - activeIndex;
      
      // Calculate vertical position
      let translateY = '0';
      let scale = 1;
      let opacity = 1;
      let zIndex = 5;
      
      if (relativePosition < -2 || relativePosition > 2) {
        // Items too far from center - hide them
        opacity = 0;
        scale = 0.5;
        zIndex = 1;
        
        if (relativePosition < 0) {
          translateY = '-120%';
        } else {
          translateY = '120%';
        }
      } else if (relativePosition === -2) {
        // Item is 2 positions above center
        translateY = '-90%';
        opacity = 0.3;
        scale = 0.6;
        zIndex = 2;
      } else if (relativePosition === -1) {
        // Item is 1 position above center
        translateY = '-45%';
        opacity = 0.7;
        scale = 0.8;
        zIndex = 3;
      } else if (relativePosition === 0) {
        // Center item
        translateY = '0';
        opacity = 1;
        scale = 1;
        zIndex = 5;
      } else if (relativePosition === 1) {
        // Item is 1 position below center
        translateY = '45%';
        opacity = 0.7;
        scale = 0.8;
        zIndex = 3;
      } else if (relativePosition === 2) {
        // Item is 2 positions below center
        translateY = '90%';
        opacity = 0.3;
        scale = 0.6;
        zIndex = 2;
      }
      
      return `
        transform: translateY(${translateY}) scale(${scale});
        opacity: ${opacity};
        z-index: ${zIndex};
      `;
    }
    
    // Setup keyboard and controller navigation
    function handleKeyDown(event: KeyboardEvent) {
      // Skip if we're in an input field
      if (
        event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement || 
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          navigateUp();
          break;
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          navigateDown();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          event.stopPropagation();
          navigateLeft();
          break;
        case 'ArrowRight':
          event.preventDefault();
          event.stopPropagation();
          navigateRight();
          break;
        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          selectCurrentItem();
          break;
      }
    }
    
    // Controller navigation
    function setupControllerEvents() {
      controllerService.addEventListener('dpad_up', () => navigateUp());
      controllerService.addEventListener('dpad_down', () => navigateDown());
      controllerService.addEventListener('dpad_left', () => navigateLeft());
      controllerService.addEventListener('dpad_right', () => navigateRight());
      controllerService.addEventListener('button_b', () => selectCurrentItem());
    }
    
    function cleanupControllerEvents() {
      controllerService.removeEventListener('dpad_up', () => {});
      controllerService.removeEventListener('dpad_down', () => {});
      controllerService.removeEventListener('dpad_left', () => {});
      controllerService.removeEventListener('dpad_right', () => {});
      controllerService.removeEventListener('button_b', () => {});
    }
    
    // Lifecycle
    onMount(() => {
      document.addEventListener('keydown', handleKeyDown);
      setupControllerEvents();
    });
    
    onDestroy(() => {
      document.removeEventListener('keydown', handleKeyDown);
      cleanupControllerEvents();
    });
  </script>
  
  <div class="carousel-container">
    <!-- Composers Carousel -->
    <div class="carousel-wrapper" class:focused={focusedCarousel === 'composers'}>
      <h2 class="carousel-title">Composers</h2>
      <div class="carousel">
        {#if composers.length === 0}
          <div class="carousel-empty">No composers found</div>
        {:else}
          {#each composers as composer, index}
            <div 
              class="carousel-item" 
              class:active={index === activeComposerIndex}
              style={getItemStyle(index, activeComposerIndex)}
            >
              <div class="carousel-item-head">
                {composer.name.charAt(0).toUpperCase()}
              </div>
              <div class="carousel-item-body">
                <p class="title">{composer.name}</p>
                <p class="subtitle">{composer.count} {composer.count === 1 ? 'piece' : 'pieces'}</p>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
    
    <!-- PDFs Carousel -->
    <div class="carousel-wrapper" class:focused={focusedCarousel === 'pdfs'}>
      <h2 class="carousel-title">
        {composers[activeComposerIndex]?.name || 'All'} Pieces
      </h2>
      <div class="carousel">
        {#if composerPdfs.length === 0}
          <div class="carousel-empty">No pieces found</div>
        {:else}
          {#each composerPdfs as pdf, index}
            <div 
              class="carousel-item" 
              class:active={index === activePdfIndex}
              style={getItemStyle(index, activePdfIndex)}
            >
              <div class="carousel-item-head pdf-preview">
                {#if pdf.annotation?.previewUrl}
                  <img src={pdf.annotation.previewUrl} alt="PDF Preview" class="preview-image">
                {:else}
                  <span>📄</span>
                {/if}
              </div>
              <div class="carousel-item-body">
                <p class="title">{pdf.annotation?.title || pdf.name}</p>
                {#if pdf.annotation && pdf.annotation?.grade > 0}
                  <p class="subtitle">Grade: {pdf.annotation.grade}</p>
                {/if}
                {#if pdf.annotation?.favorite}
                  <div class="favorite-badge">★</div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
  
  <style>
    /* Carousel Container */
    .carousel-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      width: 100%;
      height: 500px;
      margin-bottom: 20px;
    }
    
    .carousel-wrapper {
      position: relative;
      height: 100%;
      background-color: rgba(30, 30, 30, 0.7);
      border-radius: 10px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    }
    
    .carousel-wrapper.focused {
      background-color: rgba(50, 50, 50, 0.7);
      box-shadow: 0 0 0 3px #0ab9e6, 0 0 15px 5px rgba(10, 185, 230, 0.4);
    }
    
    .carousel-title {
      color: white;
      text-align: center;
      margin: 0 0 20px 0;
      font-size: 24px;
      border-bottom: 2px solid #e60012;
      padding-bottom: 10px;
    }
    
    .carousel {
      position: relative;
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    
    .carousel-empty {
      color: #999;
      font-style: italic;
      font-size: 18px;
      text-align: center;
    }
    
    /* Carousel Items */
    .carousel-item {
      display: flex;
      align-items: center;
      position: absolute;
      width: 100%;
      padding: 0 12px;
      transition: all 0.5s ease;
      will-change: transform, opacity;
    }
    
    .carousel-item-head {
      border-radius: 50%;
      background-color: #d7f7fc;
      width: 70px;
      height: 70px;
      padding: 10px;
      position: relative;
      margin-right: -35px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: bold;
      color: #333;
      z-index: 10;
    }
    
    .carousel-item-body {
      width: 100%;
      background-color: #fff;
      border-radius: 8px;
      padding: 15px 15px 15px 50px;
      min-height: 90px;
      position: relative;
    }
    
    .title {
      font-weight: bold;
      font-size: 18px;
      margin: 0 0 5px 0;
      color: #333;
    }
    
    .subtitle {
      font-size: 14px;
      color: #666;
      margin: 0;
    }
    
    .favorite-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      color: #e60012;
      font-size: 20px;
    }
    
    /* PDF preview specific styles */
    .pdf-preview {
      background-color: #333;
      overflow: hidden;
    }
    
    .preview-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .carousel-container {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
      }
    }
  </style>