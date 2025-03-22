<!-- src/svelte/PdfSelector.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { getControllerService, type GamepadEventType } from './services/ControllerService';
  import ComposerPdfCarousel from './ComposerPdfCarousel.svelte';
  
  // File metadata types
  interface FileAnnotation {
    title: string;
    composer: string;
    favorite: boolean;
    grade: number; // Numerical grade
    previewUrl: string; // URL or data URI for the cached preview
  }
  
  interface FileMetadata {
    name: string;
    path: string;
    lastOpened: Date;
    annotation?: FileAnnotation;
  }
  
  // State
  let recentFiles: FileMetadata[] = [];
  let selectedFolder: string = '';
  let folderFiles: { name: string; path: string; isDirectory: boolean; annotation?: FileAnnotation }[] = [];
  let currentPath: string[] = [];
  let isLoading: boolean = false;
  
  // Current file for annotation editing
  let selectedFileForAnnotation: FileMetadata | null = null;
  let showAnnotationDialog: boolean = false;
  
  // View mode
  let viewMode: 'grid' | 'carousel' = 'grid';
  
  const controllerService = getControllerService();
  const dispatch = createEventDispatcher();
  
  // Save recent files and annotations to localStorage
  function saveRecentFiles() {
    try {
      localStorage.setItem('recentPdfFiles', JSON.stringify(recentFiles));
    } catch (error) {
      console.error('Error saving recent files:', error);
    }
  }
  
  // Save file annotations
  function saveFileAnnotations() {
    try {
      const annotations: Record<string, FileAnnotation> = {};
      
      // Collect all annotations from recent files
      recentFiles.forEach(file => {
        if (file.annotation) {
          annotations[file.path] = file.annotation;
        }
      });
      
      localStorage.setItem('pdfFileAnnotations', JSON.stringify(annotations));
    } catch (error) {
      console.error('Error saving file annotations:', error);
    }
  }
  
  // Load file annotations
  function loadFileAnnotations(): Record<string, FileAnnotation> {
    try {
      const annotationsJson = localStorage.getItem('pdfFileAnnotations');
      if (annotationsJson) {
        return JSON.parse(annotationsJson);
      }
    } catch (error) {
      console.error('Error loading file annotations:', error);
    }
    return {};
  }
  
  // Generate a thumbnail preview for a PDF file
  async function generatePdfPreview(filePath: string): Promise<string> {
    try {
      // Check if we already have a cached preview
      const cachedPreviews = JSON.parse(localStorage.getItem('pdfPreviews') || '{}');
      if (cachedPreviews[filePath]) {
        return cachedPreviews[filePath];
      }
      
      if (!window.electron) {
        return ''; // Return empty if Electron API isn't available
      }
      
      // Read the PDF file
      const pdfData = await window.electron.readFile(filePath);
      
      // We need to ensure PDF.js is loaded
      let pdfjs: any;
      
      // Check if we need to load PDF.js
      if (!window['pdfjs-dist/build/pdf']) {
        // Load PDF.js dynamically if not already loaded
        const pdfJsScript = document.createElement('script');
        pdfJsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        document.head.appendChild(pdfJsScript);
        
        await new Promise<void>((resolve) => {
          pdfJsScript.onload = () => resolve();
        });
        
        // Initialize PDF.js
        pdfjs = window['pdfjs-dist/build/pdf'];
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      } else {
        pdfjs = window['pdfjs-dist/build/pdf'];
      }
      
      // Load the PDF document
      const loadingTask = pdfjs.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      
      // Get the first page
      const page = await pdf.getPage(1);
      
      // Create a canvas to render the page
      const canvas = document.createElement('canvas');
      const viewport = page.getViewport({ scale: 0.2 }); // Small thumbnail
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render the page
      const renderContext = {
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Get the data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // Cache the preview
      cachedPreviews[filePath] = dataUrl;
      localStorage.setItem('pdfPreviews', JSON.stringify(cachedPreviews));
      
      return dataUrl;
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      return ''; // Return empty on error
    }
  }
  
  // Load recent files from localStorage
  onMount(async () => {
    try {
      const storedFiles = localStorage.getItem('recentPdfFiles');
      if (storedFiles) {
        recentFiles = JSON.parse(storedFiles);
        // Convert string dates back to Date objects
        recentFiles.forEach(file => {
          file.lastOpened = new Date(file.lastOpened);
        });
        // Sort by most recently opened
        recentFiles.sort((a, b) => b.lastOpened.getTime() - a.lastOpened.getTime());
      }
      
      // Load annotations and associate them with files
      const annotations = loadFileAnnotations();
      recentFiles = recentFiles.map(file => {
        if (annotations[file.path]) {
          return {
            ...file,
            annotation: annotations[file.path]
          };
        }
        return file;
      });
      
      // Load cached previews
      const cachedPreviews = JSON.parse(localStorage.getItem('pdfPreviews') || '{}');
      
      // Generate previews for files without one (async)
      for (const file of recentFiles) {
        if (!file.annotation?.previewUrl) {
          // Check if we have a cached preview
          if (cachedPreviews[file.path]) {
            if (!file.annotation) {
              file.annotation = {
                title: file.name,
                composer: '',
                favorite: false,
                grade: 0,
                previewUrl: cachedPreviews[file.path]
              };
            } else {
              file.annotation.previewUrl = cachedPreviews[file.path];
            }
          } else {
            // Generate preview in background
            generatePdfPreview(file.path).then(previewUrl => {
              if (previewUrl) {
                if (!file.annotation) {
                  file.annotation = {
                    title: file.name,
                    composer: '',
                    favorite: false,
                    grade: 0,
                    previewUrl
                  };
                } else {
                  file.annotation.previewUrl = previewUrl;
                }
                // Force update
                recentFiles = [...recentFiles];
                saveFileAnnotations();
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading recent files:', error);
    }
    
    // Setup controller navigation
    setupControllerEvents();
    
    // Also listen to keyboard events for navigation
    document.addEventListener('keydown', handleKeyNavigation);
  });
  
  onDestroy(() => {
    cleanupControllerEvents();
    document.removeEventListener('keydown', handleKeyNavigation);
  });
  
  // Add a file to recent files
  async function addToRecentFiles(name: string, filePath: string) {
    // Check if file already exists in recent files
    const existingIndex = recentFiles.findIndex(file => file.path === filePath);
    if (existingIndex !== -1) {
      // Update the last opened date
      recentFiles[existingIndex].lastOpened = new Date();
    } else {
      // Generate preview for new file
      const previewUrl = await generatePdfPreview(filePath);
      
      // Create default annotation
      const newAnnotation: FileAnnotation = {
        title: name,
        composer: '',
        favorite: false,
        grade: 0,
        previewUrl
      };
      
      // Add new file with annotation
      recentFiles.push({
        name,
        path: filePath,
        lastOpened: new Date(),
        annotation: newAnnotation
      });
    }
    
    // Limit to 12 recent files
    if (recentFiles.length > 12) {
      recentFiles = recentFiles.sort((a, b) => 
        b.lastOpened.getTime() - a.lastOpened.getTime()
      ).slice(0, 12);
    }
    
    saveRecentFiles();
    saveFileAnnotations();
  }
  
  // Open file dialog to select a PDF
  async function selectPdfFile() {
    try {
      if (!window.electron) {
        console.error('Electron API not available');
        alert('PDF selection requires Electron API which is not available');
        return;
      }
      
      const result = await window.electron.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileName = filePath.split('/').pop() || filePath;
        
        addToRecentFiles(fileName, filePath);
        dispatch('select', { path: filePath, name: fileName });
      }
    } catch (error) {
      console.error('Error selecting PDF file:', error);
    }
  }
  
  // Select folder to browse PDFs
  async function selectFolder() {
    try {
      if (!window.electron) {
        console.error('Electron API not available');
        alert('Folder selection requires Electron API which is not available');
        return;
      }
      
      const result = await window.electron.showOpenDialog({
        properties: ['openDirectory']
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        selectedFolder = result.filePaths[0];
        currentPath = [selectedFolder];
        await loadFolderContents(selectedFolder);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  }
  
  // Load contents of a folder
  async function loadFolderContents(folderPath: string) {
    isLoading = true;
    folderFiles = [];
    
    try {
      if (!window.fs || !window.fs.promises) {
        console.error('File system API not available');
        alert('Folder browsing requires File system API which is not available');
        isLoading = false;
        return;
      }
      
      const files = await window.fs.promises.readdir(folderPath);
      
      // Process files and sort them (directories first, then alphabetically)
      const fileEntries = files
        .map(file => ({
          name: file.name,
          path: `${folderPath}/${file.name}`, // Simple path joining
          isDirectory: file.isDirectory
        }))
        .filter(file => file.isDirectory || file.name.toLowerCase().endsWith('.pdf'))
        .sort((a, b) => {
          // Sort directories first
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          // Then sort alphabetically
          return a.name.localeCompare(b.name);
        });
        
      // Load annotations for files if available
      const annotations = loadFileAnnotations();
      folderFiles = fileEntries.map(file => {
        if (!file.isDirectory && annotations[file.path]) {
          return {
            ...file,
            annotation: annotations[file.path]
          };
        }
        return file;
      });
      
    } catch (error) {
      console.error('Error loading folder contents:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // Navigate to a subfolder
  async function navigateToFolder(folderPath: string, isParent: boolean = false) {
    if (isParent) {
      // Navigate up one level
      currentPath.pop();
    } else {
      // Navigate into folder
      currentPath.push(folderPath);
    }
    
    await loadFolderContents(currentPath[currentPath.length - 1]);
  }
  
  // Select a file from the folder browser
  function selectFile(file: { name: string; path: string; isDirectory: boolean; annotation?: FileAnnotation }) {
    if (file.isDirectory) return;
    addToRecentFiles(file.name, file.path);
    dispatch('select', { path: file.path, name: file.name });
  }
  
  // Select a recent file
  function selectRecentFile(file: FileMetadata) {
    addToRecentFiles(file.name, file.path);
    dispatch('select', { path: file.path, name: file.name });
  }
  
  // Open annotation editor for a file
  function openAnnotationEditor(file: FileMetadata) {
    // Create a copy of the file for editing
    selectedFileForAnnotation = { ...file };
    
    // Create default annotation if none exists
    if (!selectedFileForAnnotation.annotation) {
      selectedFileForAnnotation.annotation = {
        title: file.name,
        composer: '',
        favorite: false,
        grade: 0,
        previewUrl: ''
      };
    }
    
    showAnnotationDialog = true;
  }
  
  // Save annotation changes
  function saveAnnotation() {
    if (!selectedFileForAnnotation) return;
    
    // Find and update the file in recent files
    const fileIndex = recentFiles.findIndex(f => f.path === selectedFileForAnnotation?.path);
    if (fileIndex >= 0) {
      recentFiles[fileIndex].annotation = selectedFileForAnnotation.annotation;
      recentFiles = [...recentFiles]; // Trigger update
    }
    
    saveFileAnnotations();
    closeAnnotationDialog();
  }
  
  // Close annotation dialog
  function closeAnnotationDialog() {
    showAnnotationDialog = false;
    selectedFileForAnnotation = null;
  }
  
  // Show annotation options for a file
  function showAnnotationOptions(file: FileMetadata, event: MouseEvent) {
    event.stopPropagation(); // Don't select the file
    openAnnotationEditor(file);
  }
  
  // Toggle view mode between grid and carousel
  function toggleViewMode() {
    viewMode = viewMode === 'grid' ? 'carousel' : 'grid';
  }
  
  // Handle keyboard navigation
  function handleKeyNavigation(event: KeyboardEvent) {
    // Skip if we're in an input field or the annotation dialog is open
    if (
      event.target instanceof HTMLInputElement || 
      event.target instanceof HTMLTextAreaElement || 
      event.target instanceof HTMLSelectElement ||
      showAnnotationDialog
    ) {
      return;
    }
    
    // If in carousel view, let the carousel component handle its own navigation
    if (viewMode === 'carousel') {
      // Still need to prevent default for arrow keys to prevent scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation(); // Stop propagation to prevent stream switching
      }
      return;
    }
    
    // Grid view navigation
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'Enter':
      case 'Escape':
      case 'Backspace':
        // Prevent default behavior and stop propagation
        event.preventDefault();
        event.stopPropagation();
        break;
      case 'Tab':
        // Allow tab to toggle view modes
        event.preventDefault();
        toggleViewMode();
        break;
    }
  }
  
  // Controller and keyboard navigation setup
  function setupControllerEvents() {
    // Prevent stream switching by stopping propagation of controller events
    // const handleDpadUp = (e: Event) => { e.stopPropagation(); };
    // const handleDpadDown = (e: Event) => { e.stopPropagation(); };
    // const handleDpadLeft = (e: Event) => { e.stopPropagation(); };
    // const handleDpadRight = (e: Event) => { e.stopPropagation(); };
    
    // controllerService.addEventListener('dpad_up' as GamepadEventType, handleDpadUp);
    // controllerService.addEventListener('dpad_down' as GamepadEventType, handleDpadDown);
    // controllerService.addEventListener('dpad_left' as GamepadEventType, handleDpadLeft);
    // controllerService.addEventListener('dpad_right' as GamepadEventType, handleDpadRight);
    
    // Y button to toggle view mode
    controllerService.addEventListener('button_y', toggleViewMode);
  }
  
  function cleanupControllerEvents() {
    controllerService.removeEventListener('dpad_up', () => {});
    controllerService.removeEventListener('dpad_down', () => {});
    controllerService.removeEventListener('dpad_left', () => {});
    controllerService.removeEventListener('dpad_right', () => {});
    controllerService.removeEventListener('button_y', toggleViewMode);
  }
</script>

<div class="pdf-selector console-ui">
  <div class="view-mode-toggle">
    <button class="toggle-button" on:click={toggleViewMode}>
      {viewMode === 'grid' ? 'Switch to Carousel View' : 'Switch to Grid View'} (Y)
    </button>
  </div>
  
  {#if viewMode === 'grid'}
    <!-- Grid View -->
    <div class="console-section">
      <h2 class="console-section-title">Actions</h2>
      <div class="console-tiles action-tiles">
        <button 
          class="console-button action-button"
          on:click={selectPdfFile}
          data-index="0"
        >
          <div class="console-button-icon">📄</div>
          <div class="console-button-label">Select PDF File</div>
        </button>
        
        <button 
          class="console-button action-button"
          on:click={selectFolder}
          data-index="1"
        >
          <div class="console-button-icon">📁</div>
          <div class="console-button-label">Browse Folder</div>
        </button>
      </div>
    </div>

    <!-- Recent Files Section -->
    {#if recentFiles.length > 0}
      <div class="console-section">
        <div class="section-header-with-controls">
          <h2 class="console-section-title">Recent Files</h2>
        </div>
        
        <div class="recent-files-grid">
          {#each recentFiles as file, absoluteIndex}
            <button 
              class="console-button recent-file-button" 
              on:click={() => selectRecentFile(file)}
              data-absolute-index={absoluteIndex}
              class:favorite={file.annotation?.favorite}
            >
              <!-- File preview image -->
              <div class="file-preview">
                {#if file.annotation?.previewUrl}
                  <img src={file.annotation.previewUrl} alt="PDF Preview" class="preview-image">
                {:else}
                  <div class="preview-placeholder">📄</div>
                {/if}
                
                {#if file.annotation?.favorite}
                  <div class="favorite-badge">★</div>
                {/if}
                
                <!-- Info button overlaid on thumbnail -->
                <button 
                  class="info-button" 
                  on:click={(e) => showAnnotationOptions(file, e)}
                  title="Edit annotations"
                >
                  ℹ️
                </button>
              </div>
              
              <div class="file-details">
                <!-- Display title from annotation if available, otherwise show name -->
                <div class="file-title">
                  {file.annotation?.title || file.name}
                </div>
                
                <!-- Show composer if available -->
                {#if file.annotation?.composer}
                  <div class="file-composer">{file.annotation.composer}</div>
                {/if}
                
                <!-- Show grade if available -->
                {#if file.annotation?.grade && file.annotation?.grade > 0}
                  <div class="file-grade">Grade: {file.annotation.grade}</div>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Folder Browser Section -->
    {#if selectedFolder}
      <div class="console-section">
        <h2 class="console-section-title">
          <div class="folder-header">
            <!-- Path Navigation -->
            <div class="path-navigation">
              {#each currentPath as pathPart, i}
                {#if i < currentPath.length - 1}
                  <button 
                    class="path-part" 
                    on:click={() => navigateToFolder(pathPart, false)}
                  >
                    {pathPart.split('/').pop() || pathPart}
                  </button>
                  <span class="path-separator">/</span>
                {:else}
                  <span class="current-folder">{pathPart.split('/').pop() || pathPart}</span>
                {/if}
              {/each}
            </div>
            
            <!-- Up navigation button -->
            {#if currentPath.length > 1}
              <button class="back-button" on:click={() => navigateToFolder('', true)}>
                Back
              </button>
            {/if}
          </div>
        </h2>
        
        <!-- Files and folders list -->
        {#if isLoading}
          <div class="console-loading">
            <div class="console-loading-spinner"></div>
            <div class="console-loading-text">Loading...</div>
          </div>
        {:else if folderFiles.length === 0}
          <div class="console-empty-message">No PDF files found in this folder</div>
        {:else}
          <div class="console-list folder-list">
            {#each folderFiles as file, i}
              <button 
                class="console-button folder-item-button" 
                class:is-folder={file.isDirectory}
                on:click={() => file.isDirectory ? navigateToFolder(file.path) : selectFile(file)}
                data-index={i}
              >
                <div class="console-button-icon">
                  {file.isDirectory ? '📁' : '📄'}
                </div>
                <div class="console-button-label">{file.name}</div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <!-- Carousel View -->
    <ComposerPdfCarousel 
      {recentFiles}
      on:select={(e) => dispatch('select', e.detail)}
    />
  {/if}
  
  <!-- Controller Button Prompts -->
  <div class="console-button-prompts">
    <div class="button-prompt">
      <div class="button-icon button-a">A</div>
      <div class="button-action">Back</div>
    </div>
    <div class="button-prompt">
      <div class="button-icon button-b">B</div>
      <div class="button-action">Select</div>
    </div>
    <div class="button-prompt">
      <div class="button-icon button-x">X</div>
      <div class="button-action">Annotations</div>
    </div>
    <div class="button-prompt">
      <div class="button-icon button-y">Y</div>
      <div class="button-action">Change View</div>
    </div>
    <div class="button-prompt">
      <div class="button-icon">⯅⯆⯇⯈</div>
      <div class="button-action">Navigate</div>
    </div>
  </div>
  
  <!-- Annotation Dialog -->
  {#if showAnnotationDialog && selectedFileForAnnotation && selectedFileForAnnotation.annotation}
    <div class="annotation-dialog-backdrop" on:click={closeAnnotationDialog}>
      <div class="annotation-dialog" on:click|stopPropagation={()=>{}}>
        <h2 class="annotation-dialog-title">File Annotations</h2>
        
        <div class="annotation-preview">
          {#if selectedFileForAnnotation.annotation.previewUrl}
            <img src={selectedFileForAnnotation.annotation.previewUrl} alt="PDF Preview" class="preview-image">
          {:else}
            <div class="preview-placeholder-large">📄</div>
          {/if}
          <div class="file-path">{selectedFileForAnnotation.path}</div>
        </div>
        
        <div class="annotation-form">
          <div class="form-group">
            <label for="title">Title</label>
            <input 
              type="text" 
              id="title" 
              bind:value={selectedFileForAnnotation.annotation.title} 
              placeholder="Enter title"
            >
          </div>
          
          <div class="form-group">
            <label for="composer">Composer</label>
            <input 
              type="text" 
              id="composer" 
              bind:value={selectedFileForAnnotation.annotation.composer} 
              placeholder="Enter composer name"
            >
          </div>
          
          <div class="form-group">
            <label for="grade">Grade (0-10)</label>
            <input 
              type="number" 
              id="grade" 
              bind:value={selectedFileForAnnotation.annotation.grade} 
              min="0" 
              max="10"
            >
          </div>
          
          <div class="form-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                bind:checked={selectedFileForAnnotation.annotation.favorite}
              >
              <span>Favorite</span>
            </label>
          </div>
        </div>
        
        <div class="annotation-dialog-buttons">
          <button class="dialog-button cancel-button" on:click={closeAnnotationDialog}>Cancel</button>
          <button class="dialog-button save-button" on:click={saveAnnotation}>Save</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Nintendo Switch inspired console UI styles */
  .console-ui {
    background-color: #1a1a1a;
    color: #ffffff;
    border-radius: 8px;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    max-height: 650px;
    overflow-y: auto;
    overflow-x: hidden;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .console-section {
    background-color: #232323;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 4px;
  }
  
  .console-section-title {
    font-size: 24px;
    font-weight: bold;
    margin: 0 0 16px 0;
    color: #ffffff;
    border-bottom: 2px solid #e60012;
    padding-bottom: 8px;
  }
  
  /* View mode toggle */
  .view-mode-toggle {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 15px;
  }
  
  .toggle-button {
    background-color: #555;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 10px 15px;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .toggle-button:hover {
    background-color: #666;
  }
  
  /* Section header with carousel controls */
  .section-header-with-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  
  .section-header-with-controls .console-section-title {
    margin: 0;
    border-bottom: none;
    padding-bottom: 0;
  }
  
  /* Button Styles */
  .console-button {
    display: flex;
    align-items: center;
    width: 100%;
    background-color: #333333;
    border: none;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 8px;
    color: white;
    text-align: left;
    cursor: pointer;
    font-size: 20px;
    transition: transform 0.1s ease, background-color 0.2s ease;
  }
  
  .console-button:hover {
    background-color: #3a3a3a;
    transform: translateY(-2px);
  }
  
  .console-button.focused {
    background-color: #0ab9e6;
    box-shadow: 0 0 0 3px white, 0 0 10px 5px rgba(10, 185, 230, 0.6);
    transform: scale(1.05);
    z-index: 1;
  }
  
  .console-button-icon {
    font-size: 28px;
    margin-right: 16px;
    min-width: 40px;
    text-align: center;
  }
  
  .console-button-label {
    font-weight: bold;
    font-size: 20px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }
  
  /* For directory items */
  .console-button.is-folder.focused {
    background-color: #1e88e5;
    box-shadow: 0 0 0 3px white, 0 0 10px 5px rgba(30, 136, 229, 0.6);
  }

  .console-button.is-folder:hover {
    background-color: #344258;
  }
  
  .console-button.is-folder {
    background-color: #2a3747;
  }
  
  /* Action buttons in grid layout */
  .console-tiles {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  
  .action-tiles .console-button {
    width: calc(50% - 8px);
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 24px 16px;
    text-align: center;
    height: 150px;
  }
  
  .action-tiles .console-button-icon {
    font-size: 48px;
    margin: 0 0 16px 0;
  }
  
  /* Recent files grid */
  .recent-files-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 16px;
    padding: 10px;
  }
  
  .recent-files-grid .console-button {
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    height: 220px;
    width: 170px;
    padding: 0;
    margin-bottom: 0;
    position: relative;
    overflow: hidden;
  }
  
  /* File preview styling */
  .file-preview {
    width: 100%;
    height: 170px;
    overflow: hidden;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #222;
  }
  
  .preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  .preview-placeholder {
    font-size: 48px;
    color: #555;
  }
  
  .preview-placeholder-large {
    font-size: 64px;
    color: #555;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
  }
  
  .favorite-badge {
    position: absolute;
    top: 5px;
    right: 5px;
    background-color: #e60012;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 16px;
  }
  
  .info-button {
    position: absolute;
    bottom: 5px;
    right: 5px;
    background-color: rgba(0, 0, 0, 0.5);
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    padding: 0;
    font-size: 18px;
  }
  
  .file-details {
    padding: 10px;
    width: 100%;
    height: 50px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background-color: #333;
  }
  
  .file-title {
    font-weight: bold;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 2px;
  }
  
  .file-composer {
    font-size: 12px;
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .file-grade {
    font-size: 12px;
    color: #ffcc00;
  }
  
  /* Console button customizations */
  .console-button.favorite {
    border: 2px solid #e60012;
  }
  
  /* List styles */
  .console-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    max-height: 350px;
    padding: 4px;
  }
  
  .folder-list .console-button {
    padding: 16px 20px;
  }
  
  .folder-list .console-button-label {
    font-size: 20px;
  }
  
  /* Path navigation */
  .folder-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
  }
  
  .path-navigation {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    overflow-x: auto;
    max-width: 70%;
    font-size: 18px;
  }
  
  .path-part {
    color: #0ab9e6;
    background: none;
    border: none;
    padding: 4px;
    margin: 0;
    font-size: 18px;
    cursor: pointer;
  }
  
  .path-separator {
    color: #666;
    margin: 0 4px;
  }
  
  .current-folder {
    font-weight: bold;
    padding: 4px;
    color: white;
  }
  
  .back-button {
    background-color: #e60012;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-size: 18px;
    cursor: pointer;
  }
  
  /* Loading state */
  .console-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }
  
  .console-loading-spinner {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 4px solid rgba(10, 185, 230, 0.3);
    border-top-color: #0ab9e6;
    animation: spinner 1s infinite linear;
    margin-bottom: 16px;
  }
  
  @keyframes spinner {
    to { transform: rotate(360deg); }
  }
  
  .console-loading-text {
    color: #999;
    font-size: 20px;
  }
  
  .console-empty-message {
    text-align: center;
    padding: 40px;
    color: #999;
    font-style: italic;
    font-size: 20px;
  }
  
  /* Controller button prompts */
  .console-button-prompts {
    display: flex;
    justify-content: space-between;
    margin-top: auto;
    background-color: #232323;
    border-radius: 8px;
    padding: 16px;
  }
  
  .button-prompt {
    display: flex;
    align-items: center;
    margin-right: 16px;
  }
  
  .button-icon {
    width: 32px;
    height: 32px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 16px;
    margin-right: 8px;
  }
  
  .button-a {
    background-color: #e60012;
  }
  
  .button-b {
    background-color: #e60012;
  }
  
  .button-x {
    background-color: #1e88e5;
  }
  
  .button-y {
    background-color: #ffd300;
    color: black;
  }
  
  .button-action {
    font-size: 16px;
    color: #cccccc;
  }
  
  /* Annotation dialog */
  .annotation-dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .annotation-dialog {
    background-color: #2a2a2a;
    border-radius: 10px;
    padding: 20px;
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  }
  
  .annotation-dialog-title {
    font-size: 24px;
    margin: 0 0 20px 0;
    color: #ffffff;
    border-bottom: 2px solid #e60012;
    padding-bottom: 10px;
    text-align: center;
  }
  
  .annotation-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 20px;
    background-color: #1a1a1a;
    padding: 10px;
    border-radius: 8px;
  }
  
  .annotation-preview img {
    max-width: 100%;
    max-height: 150px;
    margin-bottom: 10px;
  }
  
  .file-path {
    font-size: 12px;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
    text-align: center;
  }
  
  .annotation-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 20px;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .form-group label {
    font-size: 16px;
    font-weight: bold;
    color: #ccc;
  }
  
  .form-group input[type="text"],
  .form-group input[type="number"] {
    padding: 10px;
    border-radius: 5px;
    border: 1px solid #444;
    background-color: #333;
    color: white;
    font-size: 16px;
  }
  
  .checkbox-group {
    flex-direction: row;
    align-items: center;
  }
  
  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  
  .checkbox-group input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }
  
  .annotation-dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  
  .dialog-button {
    padding: 10px 20px;
    border-radius: 5px;
    border: none;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
  }
  
  .save-button {
    background-color: #4CAF50;
    color: white;
  }
  
  .cancel-button {
    background-color: #666;
    color: white;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .action-tiles .console-button {
      width: 100%;
      margin-bottom: 16px;
    }
    
    .console-button-prompts {
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .button-prompt {
      margin-right: 0;
      flex: 1 0 40%;
    }
  }
  
  @media (max-width: 480px) {
    .console-section-title {
      font-size: 20px;
    }
    
    .console-button-label {
      font-size: 18px;
    }
  }
</style>
  
  