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
  let focusedIndex: number = -1;
  let focusedSection: 'actions' | 'recent' | 'folder' = 'actions';
  let actionButtons: HTMLButtonElement[] = [];
  let fileButtons: HTMLButtonElement[] = [];
  
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
    
    // Set initial focus to the first action button
    setTimeout(() => {
      if (actionButtons.length === 0) {
        // Query for the action buttons if they weren't bound yet
        actionButtons = Array.from(document.querySelectorAll('.action-button')) as HTMLButtonElement[];
      }
      
      if (actionButtons.length > 0) {
        focusedIndex = 0;
        focusedSection = 'actions';
        updateFocus();
      }
    }, 100);
  });
  
  onDestroy(() => {
    // Clean up controller event listeners
    cleanupControllerEvents();
  });
  
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
    
    // Limit to 10 recent files
    if (recentFiles.length > 10) {
      recentFiles = recentFiles.sort((a, b) => 
        b.lastOpened.getTime() - a.lastOpened.getTime()
      ).slice(0, 10);
    }
    
    saveRecentFiles();
  }
  
  // Open file dialog to select a PDF
  async function selectPdfFile() {
    try {
      // Check if electron API is available
      if (!window.electron) {
        console.error('Electron API not available');
        alert('PDF selection requires Electron API which is not available');
        return;
      }
      
      // Using Electron's dialog via IPC
      const result = await window.electron.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        const fileName = filePath.split('/').pop() || filePath;
        
        // Add to recent files
        addToRecentFiles(fileName, filePath);
        
        // Dispatch selected file to parent
        dispatch('select', { path: filePath, name: fileName });
      }
    } catch (error) {
      console.error('Error selecting PDF file:', error);
    }
  }
  
  // Select folder to browse PDFs
  async function selectFolder() {
    try {
      // Check if electron API is available
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
      // Check if fs API is available
      if (!window.fs || !window.fs.promises) {
        console.error('File system API not available');
        alert('Folder browsing requires File system API which is not available');
        isLoading = false;
        return;
      }
      
      // Use the fs API exposed through our preload script
      const files = await window.fs.promises.readdir(folderPath);
      
      // Process files and sort them (directories first, then alphabetically)
      folderFiles = files
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
      
    } catch (error) {
      console.error('Error loading folder contents:', error);
    } finally {
      isLoading = false;
      
      // After loading, update button references
      setTimeout(updateButtonRefs, 100);
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
    
    // Reset focus to the first folder item after navigation completes
    setTimeout(() => {
      focusedSection = 'folder';
      focusedIndex = 0;
      updateButtonRefs();
    }, 100);
  }
  
  // Select a file from the folder browser
  function selectFile(file: { name: string; path: string }) {
    addToRecentFiles(file.name, file.path);
    dispatch('select', { path: file.path, name: file.name });
  }
  
  // Select a recent file
  function selectRecentFile(file: { name: string; path: string }) {
    // Update the last opened date
    //file.lastOpened = new Date();
    saveRecentFiles();
    dispatch('select', { path: file.path, name: file.name });
  }
  
  // Controller navigation setup
  function setupControllerEvents() {
    // D-pad for navigation
    controllerService.addEventListener('dpad_up', handleDpadUp);
    controllerService.addEventListener('dpad_down', handleDpadDown);
    controllerService.addEventListener('dpad_left', handleDpadLeft);
    controllerService.addEventListener('dpad_right', handleDpadRight);
    
    // A button for selection (typically the B button on 8BitDo maps to A in browser)
    controllerService.addEventListener('button_b', handleSelect);
    
    // Back button (typically A button on 8BitDo)
    controllerService.addEventListener('button_a', handleBack);
  }
  
  function cleanupControllerEvents() {
    controllerService.removeEventListener('dpad_up', handleDpadUp);
    controllerService.removeEventListener('dpad_down', handleDpadDown);
    controllerService.removeEventListener('dpad_left', handleDpadLeft);
    controllerService.removeEventListener('dpad_right', handleDpadRight);
    controllerService.removeEventListener('button_b', handleSelect);
    controllerService.removeEventListener('button_a', handleBack);
  }
  
  // Navigation handlers
  function handleDpadUp() {
    if (focusedSection === 'actions') {
      // Already at the top section, no change
      return;
    } else if (focusedSection === 'recent' && focusedIndex === 0) {
      // Move from first recent file to actions
      focusedSection = 'actions';
      focusedIndex = actionButtons.length - 1;
    } else if (focusedSection === 'folder' && focusedIndex === 0) {
      // Move from first folder item to recent if available, or actions
      if (recentFiles.length > 0) {
        focusedSection = 'recent';
        focusedIndex = recentFiles.length - 1;
      } else {
        focusedSection = 'actions';
        focusedIndex = actionButtons.length - 1;
      }
    } else {
      // Move up within the current section
      focusedIndex = Math.max(0, focusedIndex - 1);
    }
    updateFocus();
  }
  
  function handleDpadDown() {
    if (focusedSection === 'actions' && focusedIndex === actionButtons.length - 1) {
      // Move from actions to recent files if available, or folder
      if (recentFiles.length > 0) {
        focusedSection = 'recent';
        focusedIndex = 0;
      } else if (folderFiles.length > 0) {
        focusedSection = 'folder';
        focusedIndex = 0;
      }
    } else if (focusedSection === 'recent' && focusedIndex === recentFiles.length - 1) {
      // Move from last recent file to folder if available
      if (folderFiles.length > 0) {
        focusedSection = 'folder';
        focusedIndex = 0;
      }
    } else {
      // Move down within the current section
      const maxIndex = 
        focusedSection === 'actions' ? actionButtons.length - 1 :
        focusedSection === 'recent' ? recentFiles.length - 1 :
        folderFiles.length - 1;
      
      focusedIndex = Math.min(maxIndex, focusedIndex + 1);
    }
    updateFocus();
  }
  
  function handleDpadLeft() {
    // No left-right navigation in this view
  }
  
  function handleDpadRight() {
    // No left-right navigation in this view
  }
  
  function handleSelect() {
    // Click the currently focused button
    if (focusedSection === 'actions' && focusedIndex >= 0 && focusedIndex < actionButtons.length) {
      actionButtons[focusedIndex].click();
    } else if (focusedSection === 'recent' && focusedIndex >= 0 && focusedIndex < recentFiles.length) {
      selectRecentFile(recentFiles[focusedIndex]);
    } else if (focusedSection === 'folder' && focusedIndex >= 0 && focusedIndex < folderFiles.length) {
      const file = folderFiles[focusedIndex];
      if (file.isDirectory) {
        navigateToFolder(file.path);
      } else {
        selectFile(file);
      }
    }
  }
  
  function handleBack() {
    // Go up a folder if in folder view
    if (currentPath.length > 1) {
      navigateToFolder('', true);
    }
  }
  
  // Update the focus visually
  function updateFocus() {
    // Remove focus from all buttons
    document.querySelectorAll('.file-button, .folder-button, .action-button').forEach(button => {
      (button as HTMLElement).classList.remove('focused');
    });
    
    // Add focus to the currently selected button
    if (focusedSection === 'actions' && focusedIndex >= 0 && focusedIndex < actionButtons.length) {
      actionButtons[focusedIndex].classList.add('focused');
      actionButtons[focusedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (focusedSection === 'recent' && recentFiles.length > 0) {
      const recentButton = document.querySelectorAll('.recent-file-button')[focusedIndex] as HTMLElement;
      if (recentButton) {
        recentButton.classList.add('focused');
        recentButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } else if (focusedSection === 'folder' && folderFiles.length > 0) {
      const folderButton = document.querySelectorAll('.folder-item-button')[focusedIndex] as HTMLElement;
      if (folderButton) {
        folderButton.classList.add('focused');
        folderButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
  
  // Update button references when the button elements are rendered or changed
  function updateButtonRefs() {
    // Get references to all action buttons
    actionButtons = Array.from(document.querySelectorAll('.action-button')) as HTMLButtonElement[];
    
    // Get references to all file buttons
    fileButtons = Array.from(document.querySelectorAll('.file-button, .folder-button')) as HTMLButtonElement[];
    
    // Update the focus
    updateFocus();
  }
</script>

<div class="pdf-selector">
<div class="action-buttons">
  <button class="action-button" on:click={selectPdfFile}>Select PDF File</button>
  <button class="action-button" on:click={selectFolder}>Browse Folder</button>
</div>

<!-- Recent Files Section -->
{#if recentFiles.length > 0}
  <div class="section">
    <h3>Recent Files</h3>
    <ul class="file-list">
      {#each recentFiles as file, i}
        <li>
          <button 
            class="file-button recent-file-button" 
            on:click={() => selectRecentFile(file)}
            data-index={i}
          >
            <span class="file-name">{file.name}</span>
            <span class="file-date">{file.lastOpened.toLocaleDateString()}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<!-- Folder Browser Section -->
{#if selectedFolder}
  <div class="section">
    <h3>Folder Browser</h3>
    
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
      <button class="up-button" on:click={() => navigateToFolder('', true)}>
        ← Up
      </button>
    {/if}
    
    <!-- Files and folders list -->
    {#if isLoading}
      <div class="loading">Loading...</div>
    {:else if folderFiles.length === 0}
      <div class="empty-folder">No PDF files found in this folder</div>
    {:else}
      <ul class="file-list folder-contents">
        {#each folderFiles as file, i}
          <li>
            {#if file.isDirectory}
              <button 
                class="folder-button folder-item-button" 
                on:click={() => navigateToFolder(file.path)}
                data-index={i}
              >
                📁 {file.name}
              </button>
            {:else}
              <button 
                class="file-button folder-item-button" 
                on:click={() => selectFile(file)}
                data-index={i}
              >
                📄 {file.name}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
</div>

<style>
.pdf-selector {
  background-color: #2d2d2d;
  border-radius: 8px;
  padding: 15px;
  max-height: 500px;
  overflow-y: auto;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

button {
  padding: 8px 12px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
}

button:hover {
  background-color: #3e8e41;
}

/* Focused state for controller navigation */
button.focused {
  box-shadow: 0 0 0 3px #fff, 0 0 0 6px #4CAF50;
  z-index: 5;
  outline: none;
}

.section {
  margin-top: 20px;
}

h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #ddd;
  border-bottom: 1px solid #555;
  padding-bottom: 5px;
}

.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.file-list li {
  margin-bottom: 5px;
}

.file-button, .folder-button {
  display: flex;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  background-color: #444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-button {
  justify-content: space-between;
}

.file-button:hover, .folder-button:hover {
  background-color: #555;
}

.folder-button {
  background-color: #364b36;
}

.folder-button:hover {
  background-color: #445b44;
}

.file-name {
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-date {
  color: #999;
  font-size: 0.8em;
  margin-left: 10px;
}

.path-navigation {
  display: flex;
  align-items: center;
  background-color: #333;
  padding: 5px 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  overflow-x: auto;
  white-space: nowrap;
}

.path-part {
  padding: 2px 5px;
  background: none;
  color: #4CAF50;
  border: none;
  cursor: pointer;
  margin: 0;
}

.path-part:hover {
  text-decoration: underline;
  background: none;
}

.path-separator {
  color: #777;
  margin: 0 2px;
}

.current-folder {
  color: #ddd;
  padding: 2px 5px;
}

.up-button {
  background-color: #333;
  margin-bottom: 10px;
}

.loading, .empty-folder {
  color: #999;
  font-style: italic;
  padding: 10px;
  text-align: center;
}

.folder-contents {
  max-height: 300px;
  overflow-y: auto;
}
</style>