<!-- src/svelte/PdfViewer.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { WebMidi } from 'webmidi';
    import type { Input } from 'webmidi';
    
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
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let scale: number = 1.5;
    let status: string = 'Loading PDF viewer...';
    
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
        
      } catch (error: any) {
        status = `Error initializing PDF viewer: ${error.message}`;
        console.error('PDF viewer initialization error:', error);
      }
    });
    
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
        
        // Initial render of first page
        pageNum = 1;
        renderPage(pageNum);
        
      } catch (error: any) {
        status = `Error loading PDF: ${error.message}`;
        console.error('PDF loading error:', error);
      }
    }
    
    // Render a specific page of the PDF
    async function renderPage(num: number) {
      if (!pdfDoc) return;
      
      pageRendering = true;
      status = `Rendering page ${num}...`;
      
      try {
        // Get page
        const page = await pdfDoc.getPage(num);
        
        // Set scale based on canvas size and viewport
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render PDF page into canvas context
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        pageRendering = false;
        status = `Page ${num} of ${pageCount}`;
        
        // If there's a pending page, render it
        if (pageNumPending !== null) {
          renderPage(pageNumPending);
          pageNumPending = null;
        }
        
      } catch (error: any) {
        pageRendering = false;
        status = `Error rendering page ${num}: ${error.message}`;
        console.error('Page rendering error:', error);
      }
    }
    
    // Queue a new page render
    function queueRenderPage(num: number) {
      if (pageRendering) {
        pageNumPending = num;
      } else {
        renderPage(num);
      }
    }
    
    // Previous page navigation
    function prevPage() {
      if (pageNum <= 1) return;
      pageNum--;
      queueRenderPage(pageNum);
    }
    
    // Next page navigation
    function nextPage() {
      if (pageNum >= pageCount) return;
      pageNum++;
      queueRenderPage(pageNum);
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
    
    // Expose functions to parent component
    export function openPdf(path: string) {
      loadPdf(path);
    }
    
    // Get canvas context on component mount
    function handleCanvasRef(canvasElement: HTMLCanvasElement) {
      canvas = canvasElement;
      ctx = canvas.getContext('2d')!;
    }
    
    onDestroy(() => {
      // Cleanup
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    });
  </script>
  
  <div class="pdf-viewer">
    <div class="status-bar">
      <div class="status-message">{status}</div>
      <div class="navigation-controls">
        <button on:click={prevPage} disabled={pageNum <= 1 || !pdfDoc}>
          Previous
        </button>
        <span class="page-info" class:hidden={!pdfDoc}>
          Page {pageNum} of {pageCount}
        </span>
        <button on:click={nextPage} disabled={pageNum >= pageCount || !pdfDoc}>
          Next
        </button>
      </div>
    </div>
    
    <div class="canvas-container">
      <canvas bind:this={canvas} use:handleCanvasRef></canvas>
    </div>
    
    <div class="instructions">
      <p>Press the middle pedal to turn to the next page.</p>
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
    
    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background-color: #444;
      border-bottom: 1px solid #555;
    }
    
    .status-message {
      color: #4CAF50;
    }
    
    .navigation-controls {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .page-info {
      color: #ccc;
    }
    
    .page-info.hidden {
      visibility: hidden;
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
    
    .canvas-container {
      flex: 1;
      overflow: auto;
      display: flex;
      justify-content: center;
      background-color: #555;
      padding: 20px;
    }
    
    canvas {
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
  </style>