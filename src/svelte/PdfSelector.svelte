<!-- src/svelte/PdfSelector.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { getControllerService, type GamepadEventType } from './services/ControllerService';
  
  // State
  let recentFiles: { name: string; path: string; lastOpened: Date }[] = [];
  let selectedFolder: string = '';
  let folderFiles: { name: string; path: string; isDirectory: boolean }[] = [];
  let currentPath: string[] = [];
  let isLoading: boolean = false;
  
  // Navigation state
  let focusedIndex: number = 0;
  let focusedSection: 'actions' | 'recent' | 'folder' = 'actions';
  
  // Grid layout for recent files
  const recentFilesPerRow = 3;
  let visibleRecentFilesStart = 0;
  const visibleRecentFilesCount = recentFilesPerRow * 1; // 1 row visible at a time for carousel
  
  const controllerService = getControllerService();
  const dispatch = createEventDispatcher();
  
  // Load recent files from localStorage
  onMount(() => {
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
    } catch (error) {
      console.error('Error loading recent files:', error);
    }
    
    // Setup controller navigation
    setupControllerEvents();
    
    // Set initial focus
    setTimeout(() => {
      setInitialFocus();
      updateFocus();
    }, 100);
    
    // Also listen to keyboard events for navigation
    document.addEventListener('keydown', handleKeyNavigation);
  });
  
  onDestroy(() => {
    cleanupControllerEvents();
    document.removeEventListener('keydown', handleKeyNavigation);
  });
  
  // Set initial focus on mount
  function setInitialFocus() {
    focusedSection = 'actions';
    focusedIndex = 0;
  }
  
  // Save recent files to localStorage
  function saveRecentFiles() {
    try {
      localStorage.setItem('recentPdfFiles', JSON.stringify(recentFiles));
    } catch (error) {
      console.error('Error saving recent files:', error);
    }
  }
  
  // Add a file to recent files
  function addToRecentFiles(name: string, filePath: string) {
    // Check if file already exists in recent files
    const existingIndex = recentFiles.findIndex(file => file.path === filePath);
    if (existingIndex !== -1) {
      // Update the last opened date
      recentFiles[existingIndex].lastOpened = new Date();
    } else {
      // Add new file
      recentFiles.push({
        name,
        path: filePath,
        lastOpened: new Date()
      });
    }
    
    // Limit to 12 recent files
    if (recentFiles.length > 12) {
      recentFiles = recentFiles.sort((a, b) => 
        b.lastOpened.getTime() - a.lastOpened.getTime()
      ).slice(0, 12);
    }
    
    saveRecentFiles();
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
        
        // Switch focus to folder section
        if (folderFiles.length > 0) {
          focusedSection = 'folder';
          focusedIndex = 0;
          updateFocus();
        }
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
      
      folderFiles = files
        .map(file => ({
          name: file.name,
          path: `${folderPath}/${file.name}`,
          isDirectory: file.isDirectory
        }))
        .filter(file => file.isDirectory || file.name.toLowerCase().endsWith('.pdf'))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      
    } catch (error) {
      console.error('Error loading folder contents:', error);
    } finally {
      isLoading = false;
      updateFocus();
    }
  }
  
  // Navigate to a subfolder
  async function navigateToFolder(folderPath: string, isParent: boolean = false) {
    if (isParent) {
      currentPath.pop();
    } else {
      currentPath.push(folderPath);
    }
    
    await loadFolderContents(currentPath[currentPath.length - 1]);
    
    focusedSection = 'folder';
    focusedIndex = 0;
    updateFocus();
  }
  
  // Select a file from the folder browser
  function selectFile(file: { name: string; path: string }) {
    addToRecentFiles(file.name, file.path);
    dispatch('select', { path: file.path, name: file.name });
  }
  
  // Select a recent file
  function selectRecentFile(file: { name: string; path: string }) {
    addToRecentFiles(file.name, file.path);
    dispatch('select', { path: file.path, name: file.name });
  }
  
  // Helper to get the maximum index for the current section
  function getMaxIndexForSection(section: 'actions' | 'recent' | 'folder'): number {
    switch (section) {
      case 'actions':
        return 1; // Two action buttons: Select PDF and Browse Folder
      case 'recent':
        return Math.min(recentFiles.length - 1, recentFiles.length - 1);
      case 'folder':
        return folderFiles.length - 1;
      default:
        return 0;
    }
  }
  
  // Scroll recent files carousel left
  function scrollRecentFilesLeft() {
    if (visibleRecentFilesStart > 0) {
      visibleRecentFilesStart = Math.max(0, visibleRecentFilesStart - recentFilesPerRow);
    }
  }
  
  // Scroll recent files carousel right
  function scrollRecentFilesRight() {
    const maxStart = Math.max(0, recentFiles.length - visibleRecentFilesCount);
    if (visibleRecentFilesStart < maxStart) {
      visibleRecentFilesStart = Math.min(maxStart, visibleRecentFilesStart + recentFilesPerRow);
    }
  }
  
  // Get visible recent files for carousel
  $: visibleRecentFiles = recentFiles.slice(
    visibleRecentFilesStart,
    visibleRecentFilesStart + visibleRecentFilesCount
  );
  
  // Calculate row and column for recent files grid
  function getRowColForIndex(index: number) {
    const row = Math.floor(index / recentFilesPerRow);
    const col = index % recentFilesPerRow;
    return { row, col };
  }
  
  // Controller and keyboard navigation setup
  function setupControllerEvents() {
    controllerService.addEventListener('dpad_up', () => handleDirectionalNavigation('up'));
    controllerService.addEventListener('dpad_down', () => handleDirectionalNavigation('down'));
    controllerService.addEventListener('dpad_left', () => handleDirectionalNavigation('left'));
    controllerService.addEventListener('dpad_right', () => handleDirectionalNavigation('right'));
    
    // B button for selection
    controllerService.addEventListener('button_b', handleSelect);
    
    // A button for back
    controllerService.addEventListener('button_a', handleBack);
    
    // L/R buttons for carousel navigation
    controllerService.addEventListener('button_l1', () => {
      if (focusedSection === 'recent') {
        scrollRecentFilesLeft();
      }
    });
    
    controllerService.addEventListener('button_r1', () => {
      if (focusedSection === 'recent') {
        scrollRecentFilesRight();
      }
    });
  }
  
  function cleanupControllerEvents() {
    controllerService.removeEventListener('dpad_up', () => {});
    controllerService.removeEventListener('dpad_down', () => {});
    controllerService.removeEventListener('dpad_left', () => {});
    controllerService.removeEventListener('dpad_right', () => {});
    controllerService.removeEventListener('button_b', handleSelect);
    controllerService.removeEventListener('button_a', handleBack);
    controllerService.removeEventListener('button_l1', () => {});
    controllerService.removeEventListener('button_r1', () => {});
  }
  
  // Handle keyboard navigation
  function handleKeyNavigation(event: KeyboardEvent) {
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
        handleDirectionalNavigation('up');
        break;
      case 'ArrowDown':
        event.preventDefault();
        handleDirectionalNavigation('down');
        break;
      case 'ArrowLeft':
        event.preventDefault();
        handleDirectionalNavigation('left');
        break;
      case 'ArrowRight':
        event.preventDefault();
        handleDirectionalNavigation('right');
        break;
      case 'Enter':
        event.preventDefault();
        handleSelect();
        break;
      case 'Escape':
      case 'Backspace':
        event.preventDefault();
        handleBack();
        break;
    }
  }
  
  // Navigation direction handler
  function handleDirectionalNavigation(direction: 'up' | 'down' | 'left' | 'right') {
    switch (direction) {
      case 'up':
        navigateUp();
        break;
      case 'down':
        navigateDown();
        break;
      case 'left':
        navigateLeft();
        break;
      case 'right':
        navigateRight();
        break;
    }
    
    updateFocus();
  }
  
  // Navigate up
  function navigateUp() {
    if (focusedSection === 'actions') {
      // Already at the top, do nothing or wrap around
      return;
    } else if (focusedSection === 'recent') {
      // Go to actions section
      focusedSection = 'actions';
      focusedIndex = focusedIndex % 2; // Map to 0 or 1 for actions
    } else if (focusedSection === 'folder') {
      // If recent files exist, go there, otherwise go to actions
      if (recentFiles.length > 0) {
        focusedSection = 'recent';
        // Try to maintain horizontal position
        focusedIndex = Math.min(recentFiles.length - 1, focusedIndex % recentFilesPerRow);
      } else {
        focusedSection = 'actions';
        focusedIndex = focusedIndex % 2; // Map to 0 or 1 for actions
      }
    }
  }
  
  // Navigate down
  function navigateDown() {
    if (focusedSection === 'actions') {
      // Go to recent files if they exist, otherwise folder
      if (recentFiles.length > 0) {
        focusedSection = 'recent';
        focusedIndex = Math.min(recentFiles.length - 1, focusedIndex);
      } else if (folderFiles.length > 0) {
        focusedSection = 'folder';
        focusedIndex = 0;
      }
    } else if (focusedSection === 'recent') {
      // Go to folder section if it exists
      if (folderFiles.length > 0) {
        focusedSection = 'folder';
        focusedIndex = 0;
      }
    } else if (focusedSection === 'folder') {
      // Already at the bottom, increment index if possible
      if (focusedIndex < folderFiles.length - 1) {
        focusedIndex++;
      }
    }
  }
  
  // Navigate left
  function navigateLeft() {
    if (focusedSection === 'actions') {
      // In actions section, move between the two buttons
      focusedIndex = focusedIndex === 0 ? 1 : 0;
    } else if (focusedSection === 'recent') {
      // In recent files grid, move left if possible
      const { row, col } = getRowColForIndex(focusedIndex);
      if (col > 0) {
        // Move left within the row
        focusedIndex--;
      } else if (visibleRecentFilesStart > 0) {
        // Scroll carousel left
        scrollRecentFilesLeft();
        // Keep same position in new view
        focusedIndex = focusedIndex;
      }
    } else if (focusedSection === 'folder') {
      // For folder section, left doesn't do anything as it's a vertical list
    }
  }
  
  // Navigate right
  function navigateRight() {
    if (focusedSection === 'actions') {
      // In actions section, move between the two buttons
      focusedIndex = focusedIndex === 0 ? 1 : 0;
    } else if (focusedSection === 'recent') {
      // In recent files grid, move right if possible
      const { row, col } = getRowColForIndex(focusedIndex);
      const maxCol = Math.min(recentFilesPerRow - 1, recentFiles.length - 1 - (row * recentFilesPerRow));
      
      if (col < maxCol) {
        // Move right within the row
        focusedIndex++;
      } else {
        // Check if we can scroll the carousel right
        const maxStart = Math.max(0, recentFiles.length - visibleRecentFilesCount);
        if (visibleRecentFilesStart < maxStart) {
          scrollRecentFilesRight();
          // Keep same position in new view
          focusedIndex = focusedIndex;
        }
      }
    } else if (focusedSection === 'folder') {
      // For folder section, right doesn't do anything as it's a vertical list
    }
  }
  
  function handleSelect() {
    if (focusedSection === 'actions') {
      if (focusedIndex === 0) {
        selectPdfFile();
      } else {
        selectFolder();
      }
    } else if (focusedSection === 'recent' && recentFiles.length > 0) {
      const absoluteIndex = visibleRecentFilesStart + focusedIndex;
      if (absoluteIndex < recentFiles.length) {
        selectRecentFile(recentFiles[absoluteIndex]);
      }
    } else if (focusedSection === 'folder' && folderFiles.length > 0) {
      if (focusedIndex < folderFiles.length) {
        const file = folderFiles[focusedIndex];
        if (file.isDirectory) {
          navigateToFolder(file.path);
        } else {
          selectFile(file);
        }
      }
    }
  }
  
  function handleBack() {
    if (currentPath.length > 1) {
      navigateToFolder('', true);
    }
  }
  
  // Update the focus visually
  function updateFocus() {
    // Remove focus from all buttons
    document.querySelectorAll('.console-button').forEach(button => {
      (button as HTMLElement).classList.remove('focused');
    });
    
    // Add focus to the correct element based on section and index
    let focusedElement: HTMLElement | null = null;
    
    if (focusedSection === 'actions') {
      focusedElement = document.querySelector(`.action-button[data-index="${focusedIndex}"]`) as HTMLElement;
    } else if (focusedSection === 'recent' && recentFiles.length > 0) {
      const visualIndex = focusedIndex;
      focusedElement = document.querySelector(`.recent-file-button[data-visual-index="${visualIndex}"]`) as HTMLElement;
    } else if (focusedSection === 'folder' && folderFiles.length > 0) {
      focusedElement = document.querySelector(`.folder-item-button[data-index="${focusedIndex}"]`) as HTMLElement;
    }
    
    if (focusedElement) {
      focusedElement.classList.add('focused');
      focusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
</script>

<div class="pdf-selector console-ui">
  <div class="console-section">
    <h2 class="console-section-title">Actions</h2>
    <div class="console-tiles action-tiles">
      <button 
        class="console-button action-button"
        on:click={selectPdfFile}
        data-index="0"
        class:focused={focusedSection === 'actions' && focusedIndex === 0}
      >
        <div class="console-button-icon">📄</div>
        <div class="console-button-label">Select PDF File</div>
      </button>
      
      <button 
        class="console-button action-button"
        on:click={selectFolder}
        data-index="1"
        class:focused={focusedSection === 'actions' && focusedIndex === 1}
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
        <div class="carousel-controls">
          <button 
            class="carousel-button left"
            on:click={scrollRecentFilesLeft}
            disabled={visibleRecentFilesStart === 0}
          >
            &lt;
          </button>
          <div class="carousel-indicator">
            {Math.floor(visibleRecentFilesStart / recentFilesPerRow) + 1} / 
            {Math.ceil(recentFiles.length / recentFilesPerRow)}
          </div>
          <button 
            class="carousel-button right"
            on:click={scrollRecentFilesRight}
            disabled={visibleRecentFilesStart + visibleRecentFilesCount >= recentFiles.length}
          >
            &gt;
          </button>
        </div>
      </div>
      
      <div class="recent-files-carousel">
        <div class="console-tiles recent-files-grid">
          {#each visibleRecentFiles as file, visualIndex}
            {@const absoluteIndex = visibleRecentFilesStart + visualIndex}
            <button 
              class="console-button recent-file-button" 
              on:click={() => selectRecentFile(file)}
              data-visual-index={visualIndex}
              data-absolute-index={absoluteIndex}
              class:focused={focusedSection === 'recent' && focusedIndex === visualIndex}
            >
              <div class="console-button-icon">📄</div>
              <div class="console-button-content">
                <div class="console-button-label">{file.name}</div>
                <div class="console-button-subtitle">{file.lastOpened.toLocaleDateString()}</div>
              </div>
            </button>
          {/each}
        </div>
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
              class:focused={focusedSection === 'folder' && focusedIndex === i}
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
      <div class="button-icon button-lr">L/R</div>
      <div class="button-action">Scroll Files</div>
    </div>
    <div class="button-prompt">
      <div class="button-icon">⯅⯆⯇⯈</div>
      <div class="button-action">Navigate</div>
    </div>
  </div>
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
  
  .carousel-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .carousel-button {
    width: 36px;
    height: 36px;
    border-radius: 18px;
    background-color: #333;
    color: white;
    border: none;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .carousel-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .carousel-button:not(:disabled):hover {
    background-color: #444;
  }
  
  .carousel-indicator {
    font-size: 16px;
    color: #ccc;
    min-width: 60px;
    text-align: center;
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
  
  .console-button-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }
  
  .console-button-label {
    font-weight: bold;
    font-size: 20px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }
  
  .console-button-subtitle {
    font-size: 16px;
    opacity: 0.8;
    margin-top: 4px;
  }
  
  /* For directory items */
  .console-button.is-folder {
    background-color: #2a3747;
  }
  
  .console-button.is-folder:hover {
    background-color: #344258;
  }
  
  .console-button.is-folder.focused {
    background-color: #1e88e5;
    box-shadow: 0 0 0 3px white, 0 0 10px 5px rgba(30, 136, 229, 0.6);
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
  .recent-files-carousel {
    overflow: hidden;
  }
  
  .recent-files-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    transition: transform 0.3s ease;
  }
  
  .recent-files-grid .console-button {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    height: 170px;
    padding: 16px;
    margin-bottom: 0;
  }
  
  .recent-files-grid .console-button-icon {
    font-size: 48px;
    margin: 0 0 12px 0;
  }
  
  .recent-files-grid .console-button-content {
    width: 100%;
  }
  
  .recent-files-grid .console-button-label {
    font-size: 18px;
    text-align: center;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    word-break: break-word;
    height: 50px;
  }
  
  .recent-files-grid .console-button-subtitle {
    text-align: center;
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
  
  .button-lr {
    background-color: #808080;
  }
  
  .button-action {
    font-size: 16px;
    color: #cccccc;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .action-tiles .console-button {
      width: 100%;
      margin-bottom: 16px;
    }
    
    .recent-files-grid {
      grid-template-columns: repeat(2, 1fr);
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
    .recent-files-grid {
      grid-template-columns: 1fr;
    }
    
    .console-section-title {
      font-size: 20px;
    }
    
    .console-button-label {
      font-size: 18px;
    }
  }
  </style>