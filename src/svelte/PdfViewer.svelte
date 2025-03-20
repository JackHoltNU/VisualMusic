<!-- src/svelte/PdfViewer.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { WebMidi } from 'webmidi';
    import type { Input } from 'webmidi';
    import { getControllerService, type GamepadEventType } from './services/ControllerService';
    
    // PDF.js library for rendering PDFs
    let pdfjs: any;
    
    // Props
    export let pdfPath: string = '';
    export let midiInputId: string = '';
    
    // State
    let pdfDoc: any = null;
    let pageNum: number = 1;
    let pageCount: number = 0;
    let pageRendering: boolean = false;
    let pageNumPending: number | null = null;
    let canvases: HTMLCanvasElement[] = [];
    let canvasContexts: CanvasRenderingContext2D[] = [];
    let scale: number = 1.5;
    let status: string = 'Loading PDF viewer...';
    let isFullscreen: boolean = false;
    let pagesPerView: number = 1;
    let renderedPages: number[] = [];
    let canvasContainer: HTMLDivElement;
    let controllerService = getControllerService();
    
    const dispatch = createEventDispatcher();
    
    // Load PDF.js script dynamically
    onMount(async () => {
      status = 'Initializing PDF viewer...';
      
      try {
        // Load PDF.js from CDN
        const pdfJsScript = document.createElement('script');
        pdfJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        document.head.appendChild(pdfJsScript);
        
        await new Promise<void>((resolve) => {
          pdfJsScript.onload = () => resolve();
        });
        
        // Initialize PDF.js
        pdfjs = window['pdfjs-dist/build/pdf'];
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        // If we have a path, load the PDF
        if (pdfPath) {
          loadPdf(pdfPath);
        } else {
          status = 'Ready to load PDF';
        }
        
        // Setup MIDI for pedal detection
        setupMidiPedalDetection();
        
        // Listen for fullscreen change events
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Setup controller events
        setupControllerEvents();
        
      } catch (error: any) {
        status = `Error initializing PDF viewer: ${error.message}`;
        console.error('PDF viewer initialization error:', error);
      }
    });
    
    onDestroy(() => {
      // Cleanup
      if (pdfDoc) {
        pdfDoc.destroy();
      }
      
      // Remove fullscreen listener
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      
      // Exit fullscreen if active
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
          console.error('Error exiting fullscreen:', err);
        });
      }
      
      // Clean up controller events
      cleanupControllerEvents();
    });
    
    // Handle fullscreen changes from browser
    function handleFullscreenChange() {
      isFullscreen = !!document.fullscreenElement;
      
      // Re-render pages when fullscreen changes to adjust layout
      if (pdfDoc) {
        // Slight delay to allow the browser to complete fullscreen transition
        setTimeout(() => {
          queueRenderPages(pageNum);
        }, 150);
      }
    }
    
    // Toggle fullscreen mode
    async function toggleFullscreen() {
      try {
        if (!isFullscreen) {
          if (canvasContainer.requestFullscreen) {
            await canvasContainer.requestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          }
        }
      } catch (error) {
        console.error('Fullscreen error:', error);
      }
    }
    
    // Load a PDF file
    async function loadPdf(path: string) {
      if (!pdfjs) {
        status = 'PDF viewer not initialized yet';
        return;
      }
      
      try {
        status = 'Loading PDF...';
        
        // Load the PDF file
        pdfDoc = await pdfjs.getDocument(path).promise;
        pageCount = pdfDoc.numPages;
        status = `PDF loaded, ${pageCount} pages`;
        
        // Reset to first page and render
        pageNum = 1;
        renderedPages = [];
        
        // Clear existing canvases
        canvases = [];
        canvasContexts = [];
        
        // Create canvases for pagesPerView
        createCanvases();
        
        // Render first set of pages
        queueRenderPages(pageNum);
        
      } catch (error: any) {
        status = `Error loading PDF: ${error.message}`;
        console.error('PDF loading error:', error);
      }
    }
    
    // Create canvases for rendering
    function createCanvases() {
      // Clear current canvas container
      if (canvasContainer) {
        canvasContainer.innerHTML = '';
      }
      
      // Create a row container for horizontal layout
      const rowContainer = document.createElement('div');
      rowContainer.className = 'canvas-row';
      canvasContainer.appendChild(rowContainer);
      
      // Create new canvases
      canvases = [];
      canvasContexts = [];
      
      for (let i = 0; i < pagesPerView; i++) {
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvases.push(canvas);
          canvasContexts.push(ctx);
          
          if (rowContainer) {
            rowContainer.appendChild(canvas);
          }
        }
      }
    }
    
    // Render a set of pages starting from specified page number
    async function renderPages(startPageNum: number) {
      if (!pdfDoc) return;
      
      pageRendering = true;
      status = `Rendering pages ${startPageNum} to ${Math.min(startPageNum + pagesPerView - 1, pageCount)}...`;
      
      renderedPages = [];
      
      // First get all pages to determine optimal scaling for the view
      const pages = [];
      const viewports = [];
      
      for (let i = 0; i < pagesPerView; i++) {
        const pageIndex = startPageNum + i - 1;  // Convert to 0-based index
        
        // Skip if beyond page count
        if (pageIndex >= pageCount) {
          // Hide unused canvases
          if (i < canvases.length) {
            canvases[i].style.display = 'none';
          }
          continue;
        }
        
        // Show canvas
        if (i < canvases.length) {
          canvases[i].style.display = 'block';
        }
        
        try {
          // Get page
          const page = await pdfDoc.getPage(pageIndex + 1);  // Convert back to 1-based
          pages.push(page);
          
          // Get viewport at scale 1 to calculate proportions
          const viewport = page.getViewport({ scale: 1.0 });
          viewports.push(viewport);
        } catch (error: any) {
          console.error(`Error loading page ${pageIndex + 1}:`, error);
        }
      }
      
      // Calculate optimal scale to fit the height of the container
      let optimalScale = scale;
      
      if (pages.length > 0) {
        // Get container dimensions
        const containerHeight = canvasContainer.clientHeight - 40; // Subtract padding
        const containerWidth = canvasContainer.clientWidth - 40; // Subtract padding
        
        // Calculate the total width needed at current scale and the tallest page
        let maxHeight = 0;
        let totalWidth = 0;
        
        viewports.forEach(viewport => {
          maxHeight = Math.max(maxHeight, viewport.height);
          totalWidth += viewport.width;
        });
        
        // Calculate width per page allowing for some margin between pages
        const pageSpacing = 20; // pixels between pages
        const totalPageSpacing = (pages.length - 1) * pageSpacing;
        const availableWidthPerPage = (containerWidth - totalPageSpacing) / pages.length;
        
        // Calculate scale that would fit all pages side by side
        const widthScale = availableWidthPerPage / (totalWidth / pages.length);
        
        // Calculate scale that would fit height
        const heightScale = containerHeight / maxHeight;
        
        // Use the smaller scale to ensure it fits in both dimensions
        optimalScale = Math.min(widthScale, heightScale);
        
        // Apply fullscreen modifier if needed
        if (isFullscreen) {
          optimalScale *= 1.2; // Slight boost for fullscreen
        }
      }
      
      // Now render each page with the optimal scale
      for (let i = 0; i < pages.length; i++) {
        try {
          const page = pages[i];
          const viewport = page.getViewport({ scale: optimalScale });
          
          // Set canvas size
          if (i < canvases.length) {
            canvases[i].height = viewport.height;
            canvases[i].width = viewport.width;
            
            // Render PDF page into canvas context
            const renderContext = {
              canvasContext: canvasContexts[i],
              viewport: viewport
            };
            
            await page.render(renderContext).promise;
            renderedPages.push(startPageNum + i);  // Store rendered page number (1-based)
          }
        } catch (error: any) {
          console.error(`Error rendering page ${startPageNum + i}:`, error);
        }
      }
      
      pageRendering = false;
      status = `Displaying pages ${startPageNum} to ${Math.min(startPageNum + pagesPerView - 1, pageCount)} of ${pageCount}`;
      
      // If there's a pending page, render it
      if (pageNumPending !== null) {
        renderPages(pageNumPending);
        pageNumPending = null;
      }
    }
    
    // Queue a new set of pages to render
    function queueRenderPages(startPageNum: number) {
      if (pageRendering) {
        pageNumPending = startPageNum;
      } else {
        renderPages(startPageNum);
      }
    }
    
    // Update pages per view
    function updatePagesPerView() {
      // Don't allow values less than 1 or greater than 4
      pagesPerView = Math.max(1, Math.min(4, pagesPerView));
      
      // Recreate canvases and re-render
      if (pdfDoc) {
        createCanvases();
        
        // Adjust page number to ensure it's a proper starting page
        // For example, if we were on page 2 and switch to 2-page view, 
        // we should show pages 1-2, not 2-3
        if (pagesPerView > 1) {
          // Calculate the first page of the current "set" to maintain context
          pageNum = Math.floor((pageNum - 1) / pagesPerView) * pagesPerView + 1;
        }
        
        queueRenderPages(pageNum);
      }
    }
    
    // Previous page navigation
    function prevPage() {
      if (pageNum <= 1) return;
      
      // Move back by pagesPerView, but never below 1
      pageNum = Math.max(1, pageNum - pagesPerView);
      queueRenderPages(pageNum);
    }
    
    // Next page navigation
    function nextPage() {
      if (pageNum + pagesPerView > pageCount) return;
      
      pageNum += pagesPerView;
      queueRenderPages(pageNum);
    }
    
    // Setup MIDI pedal detection for page turning
    function setupMidiPedalDetection() {
      if (!midiInputId) return;
      
      try {
        const input = WebMidi.getInputById(midiInputId);
        if (!input) {
          console.log('Selected MIDI input not found for pedal detection');
          return;
        }
        
        // Listen for control change messages (pedals)
        input.addListener('controlchange', e => {
          // Controller number 4 is often the "middle pedal" on many pianos
          // But this may need adjustment based on your specific MIDI device
          if (e.controller.number === 4) {
            // If pedal is pressed (value > 64 in most cases)
            if (e.value > 64) {
              nextPage();
            } 
            // Some pedals might use the release for page turning instead
            // else if (e.value < 32) {
            //   prevPage();
            // }
          }
        });
        
        console.log('MIDI pedal detection set up successfully');
        
      } catch (error) {
        console.error('Error setting up MIDI pedal detection:', error);
      }
    }
    
    // Zoom in/out controls
    function zoomIn() {
      scale += 0.25;
      if (pdfDoc) {
        queueRenderPages(pageNum);
      }
    }
    
    function zoomOut() {
      scale = Math.max(0.5, scale - 0.25);
      if (pdfDoc) {
        queueRenderPages(pageNum);
      }
    }
    
    // Setup controller events
    function setupControllerEvents() {
      // Navigation
      controllerService.addEventListener('dpad_left', () => prevPage());
      controllerService.addEventListener('dpad_right', () => nextPage());
      
      // Go to first/last page
      controllerService.addEventListener('dpad_up', () => {
        pageNum = 1;
        queueRenderPages(pageNum);
      });
      
      controllerService.addEventListener('dpad_down', () => {
        pageNum = Math.max(1, pageCount - pagesPerView + 1);
        queueRenderPages(pageNum);
      });
      
      // Zoom controls
      controllerService.addEventListener('button_plus', () => zoomIn());
      controllerService.addEventListener('button_minus', () => zoomOut());
      
      // Select/back - B button is select, A button is back
      controllerService.addEventListener('button_b', () => toggleFullscreen());
      
      // L and R triggers for quick navigation by larger steps
      controllerService.addEventListener('button_l1', () => {
        const jumpSize = 5 * pagesPerView;
        pageNum = Math.max(1, pageNum - jumpSize);
        queueRenderPages(pageNum);
      });
      
      controllerService.addEventListener('button_r1', () => {
        const jumpSize = 5 * pagesPerView;
        pageNum = Math.min(pageCount - pagesPerView + 1, pageNum + jumpSize);
        queueRenderPages(pageNum);
      });
    }
    
    // Clean up controller events
    function cleanupControllerEvents() {
      const events: GamepadEventType[] = [
        'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right',
        'button_a', 'button_b', 'button_plus', 'button_minus',
        'button_l1', 'button_r1'
      ];
      
      events.forEach(event => {
        controllerService.removeEventListener(event, () => {});
      });
    }
    
    // Expose functions to parent component
    export function openPdf(path: string) {
      loadPdf(path);
    }
    
    // Go to specific page
    function goToPage(event: Event) {
      const input = event.target as HTMLInputElement;
      const targetPage = parseInt(input.value);
      
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= pageCount) {
        pageNum = targetPage;
        queueRenderPages(pageNum);
      } else {
        // Reset input to current page if invalid
        input.value = pageNum.toString();
      }
    }
  </script>
  
  <div class="pdf-viewer" class:fullscreen={isFullscreen}>
    <div class="status-bar">
      <div class="status-message">{status}</div>
      
      <div class="view-controls">
        <label for="pages-per-view">Pages:</label>
        <select 
          id="pages-per-view" 
          bind:value={pagesPerView}
          on:change={updatePagesPerView}
          disabled={!pdfDoc}
        >
          <option value="1">Single page</option>
          <option value="2">Two pages</option>
          <option value="3">Three pages</option>
          <option value="4">Four pages</option>
        </select>
        
        <button 
          class="control-button zoom-button" 
          on:click={zoomOut} 
          disabled={!pdfDoc || scale <= 0.5}
          title="Zoom out"
        >
          −
        </button>
        <button 
          class="control-button zoom-button" 
          on:click={zoomIn} 
          disabled={!pdfDoc}
          title="Zoom in"
        >
          +
        </button>
        
        <button 
          class="control-button fullscreen-button" 
          on:click={toggleFullscreen}
          disabled={!pdfDoc}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>
      
      <div class="navigation-controls">
        <button class="nav-button" on:click={prevPage} disabled={pageNum <= 1 || !pdfDoc}>
          Previous
        </button>
        
        <div class="page-input-container">
          <input 
            type="number" 
            class="page-input" 
            value={pageNum} 
            min="1" 
            max={pageCount} 
            disabled={!pdfDoc}
            on:change={goToPage}
          />
          <span class="page-info" class:hidden={!pdfDoc}>
            of {pageCount}
          </span>
        </div>
        
        <button class="nav-button" on:click={nextPage} disabled={pageNum + pagesPerView > pageCount || !pdfDoc}>
          Next
        </button>
      </div>
    </div>
    
    <div class="canvas-container" bind:this={canvasContainer}>
      <!-- Canvases will be dynamically added here -->
    </div>
    
    <div class="instructions" class:hidden={isFullscreen}>
      <p>
        Press the middle pedal to turn to the next page. Press ESC to exit fullscreen mode.
        {#if controllerService.isConnected}
          <br>
          <strong>Controller:</strong> D-Pad to navigate, +/- to zoom, B to toggle fullscreen
        {/if}
      </p>
    </div>
  </div>
  
  <style>
    .pdf-viewer {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background-color: #333;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .pdf-viewer.fullscreen {
      border-radius: 0;
    }
    
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background-color: #444;
      border-bottom: 1px solid #555;
      z-index: 10;
    }
    
    .status-message {
      color: #4CAF50;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 10px;
    }
    
    .view-controls, .navigation-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .page-info {
      color: #ccc;
    }
    
    .page-info.hidden {
      visibility: hidden;
    }
    
    .page-input-container {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .page-input {
      width: 50px;
      background-color: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 4px;
      text-align: center;
    }
    
    button {
      padding: 6px 12px;
      background-color: #555;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    button:hover:not(:disabled) {
      background-color: #666;
    }
    
    button:disabled {
      background-color: #444;
      color: #777;
      cursor: not-allowed;
    }
    
    .fullscreen-button {
      background-color: #4c7caf;
    }
    
    .fullscreen-button:hover:not(:disabled) {
      background-color: #5889bf;
    }
    
    .zoom-button {
      padding: 4px 8px;
      min-width: 30px;
      font-weight: bold;
      font-size: 16px;
    }
    
    select {
      padding: 5px;
      background-color: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      min-width: 100px;
    }
    
    .canvas-container {
      flex: 1;
      overflow: auto;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background-color: #555;
      padding: 20px;
    }
    
    :global(.canvas-row) {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      gap: 20px;
      max-height: 100%;
    }
    
    :global(.pdf-canvas) {
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      background-color: white;
    }
    
    .instructions {
      padding: 8px;
      text-align: center;
      background-color: #444;
      color: #ccc;
      font-style: italic;
      font-size: 14px;
    }
    
    .hidden {
      display: none;
    }
    
    /* Fullscreen specific styles */
    :fullscreen .canvas-container {
      background-color: #444;
    }
  </style>