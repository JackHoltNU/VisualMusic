<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { WebMidi } from 'webmidi';
  import type { Input } from 'webmidi';
  import MidiNote from './MidiNote.svelte';
  import PianoSimulator from './PianoSimulator.svelte';
  import MusicAnalysis from './MusicAnalysis.svelte';
  import PdfStream from './PdfStream.svelte';
  import SynthModule from './SynthModule.svelte';
  import { MusicTheoryService, type NoteData, type KeySignatureInfo, type IntervalInfo, type ChordInfo } from './services/MusicTheoryService';
  
  // Enum for stream types
  enum StreamType {
    Visualization = 'visualization',
    PdfDisplay = 'pdf',
    Synthesizer = 'synth'
  }
  
  // State
  let status: string = 'Initializing WebMidi...';
  let midiInputs: Input[] = [];
  let selectedInputId: string = '';
  let activeNotes: Map<string, NoteData> = new Map();
  let notesArray: NoteData[] = [];
  let useFallbackPiano: boolean = false;
  let currentStream: StreamType = StreamType.Visualization;
  let isBluetoothControllerConnected: boolean = false;
  
  // Music theory analysis
  const musicService = new MusicTheoryService();
  let currentKey: KeySignatureInfo | null = null;
  let intervals: IntervalInfo[] = [];
  let chords: ChordInfo[] = [];
  
  // Update the notes array and perform music analysis
  function updateNotesArray() {
    notesArray = Array.from(activeNotes.values());
    
    // Update active notes in the music service
    musicService.setActiveNotes(notesArray);
    
    // Detect key signature
    currentKey = musicService.detectKey();
    
    // Process notes to mark as in-key or accidental
    notesArray = musicService.processNotes(notesArray);
    
    // Update the map with the new inKey property
    notesArray.forEach(note => {
      activeNotes.set(note.id, note);
    });
    
    // Detect intervals and chords
    intervals = musicService.detectIntervals();
    chords = musicService.detectChords();
  }
  
  // Handle key reset
  function handleKeyReset() {
    currentKey = null;
    updateNotesArray();
  }
  
  // Handle MIDI Input setup
  function setupMidiInput(inputId: string) {
    // Clear existing notes
    activeNotes.clear();
    updateNotesArray();
    
    const input = WebMidi.getInputById(inputId);
    if (!input) {
      status = 'Selected MIDI input not found';
      return;
    }
    
    status = `Connected to: ${input.name}`;
    
    // Listen for note on events
    input.addListener('noteon', e => {
      const noteId = `${e.note.number}`;
      const octave = Math.floor(e.note.number / 12) - 1;
      const noteName = e.note.name + octave;
      
      activeNotes.set(noteId, {
        id: noteId,
        name: noteName,
        midiNumber: e.note.number,
        velocity: e.velocity,
        timestamp: Date.now(),
        inKey: true, // Default value, will be updated in updateNotesArray
        active: true
      });
      
      updateNotesArray();
    });
    
    // Listen for note off events
    input.addListener('noteoff', e => {
      const noteId = `${e.note.number}`;
      if (activeNotes.has(noteId)) {
        const note = activeNotes.get(noteId)!;
        note.timestamp = Date.now(); // Mark as released
        note.active = false;
        activeNotes.set(noteId, note);
        updateNotesArray();
      }
    });
  }
  
  // Handle simulator events
  function handleSimulatorNoteOn(event: { detail: { note: any; velocity: any; }; }) {
    const { note, velocity } = event.detail;
    const noteId = `${note.number}`;
    
    activeNotes.set(noteId, {
      id: noteId,
      name: note.name + note.octave,
      midiNumber: note.number,
      velocity: velocity,
      timestamp: Date.now(),
      inKey: true, // Default value, will be updated in updateNotesArray
      active: true
    });
    
    updateNotesArray();
  }
  
  function handleSimulatorNoteOff(event: { detail: { note: any; }; }) {
    const { note } = event.detail;
    const noteId = `${note.number}`;
    
    if (activeNotes.has(noteId)) {
      const activeNote = activeNotes.get(noteId)!;
      activeNote.timestamp = Date.now();
      activeNote.active = false;
      activeNotes.set(noteId, activeNote);
      updateNotesArray();
    }
  }
  
  // Toggle fallback piano
  function toggleFallbackPiano() {
    useFallbackPiano = !useFallbackPiano;
    if (useFallbackPiano) {
      status = 'Using virtual piano (MIDI input disabled)';
    } else {
      status = 'Virtual piano disabled';
      if (selectedInputId) {
        setupMidiInput(selectedInputId);
      }
    }
  }
  
  // Animation frame for note fading
  let animationFrame: number;
  
  function updateFadingNotes() {
    const now = Date.now();
    const fadeDuration = 3000; // 3 seconds fade
    let notesChanged = false;
    
    activeNotes.forEach((note, key) => {
      const elapsed = now - note.timestamp;
      if (elapsed > fadeDuration) {
        activeNotes.delete(key);
        notesChanged = true;
      }
    });
    
    if (notesChanged) {
      updateNotesArray();
    }
    
    animationFrame = requestAnimationFrame(updateFadingNotes);
  }
  
  // Bluetooth controller setup
  async function setupBluetoothController() {
    try {
      // This would usually involve Web Bluetooth API, 
      // but for simplicity we're just simulating a connection
      status = 'Searching for 8BitDo controller...';
      
      // Simulate a delay for searching
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate success
      isBluetoothControllerConnected = true;
      status = 'Connected to 8BitDo controller';
      
      // In a real implementation, this would set up event handlers for controller inputs
      // For now, we'll just add keyboard shortcuts to simulate controller navigation
      
    } catch (error) {
      console.error('Error connecting to Bluetooth controller:', error);
      status = 'Failed to connect to controller';
    }
  }
  
  // Lifecycle
  onMount(async () => {
    try {
      await WebMidi.enable();
      status = 'WebMidi enabled successfully!';
      midiInputs = WebMidi.inputs;
      
      if (midiInputs.length === 0) {
        status = 'No MIDI inputs detected. Using virtual piano.';
        useFallbackPiano = true;
      } else {
        // Set default input if available
        selectedInputId = midiInputs[0].id;
        setupMidiInput(selectedInputId);
      }
      
      // Start animation frame
      animationFrame = requestAnimationFrame(updateFadingNotes);
      
      // Setup keyboard navigation for streams (simulating controller)
      document.addEventListener('keydown', handleKeyboardNavigation);
      
    } catch (err) {
      status = `WebMidi could not be enabled: ${err}. Using virtual piano.`;
      useFallbackPiano = true;
      
      // Still need animation frame
      animationFrame = requestAnimationFrame(updateFadingNotes);
    }
  });
  
  onDestroy(() => {
    // Clean up animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    
    // Clean up MIDI listeners
    try {
      WebMidi.inputs.forEach(input => {
        input.removeListener();
      });
    } catch (error) {
      console.log('Error during MIDI cleanup:', error);
    }
    
    // Remove keyboard navigation listener
    document.removeEventListener('keydown', handleKeyboardNavigation);
  });
  
  // Handle input selection change
  function handleInputChange() {
    if (selectedInputId && !useFallbackPiano) {
      setupMidiInput(selectedInputId);
    }
  }
  
  // Handle stream selection
  function selectStream(stream: StreamType) {
    currentStream = stream;
  }
  
  // Keyboard navigation (simulating controller)
  function handleKeyboardNavigation(event: KeyboardEvent) {
    // Only process if it's a navigation key
    if (!['ArrowLeft', 'ArrowRight', '1', '2', '3'].includes(event.key)) {
      return;
    }
    
    // Prevent default behavior for these keys
    event.preventDefault();
    
    // Handle stream switching
    if (event.key === 'ArrowLeft') {
      // Move to previous stream
      if (currentStream === StreamType.Visualization) {
        selectStream(StreamType.Synthesizer);
      } else if (currentStream === StreamType.PdfDisplay) {
        selectStream(StreamType.Visualization);
      } else if (currentStream === StreamType.Synthesizer) {
        selectStream(StreamType.PdfDisplay);
      }
    } else if (event.key === 'ArrowRight') {
      // Move to next stream
      if (currentStream === StreamType.Visualization) {
        selectStream(StreamType.PdfDisplay);
      } else if (currentStream === StreamType.PdfDisplay) {
        selectStream(StreamType.Synthesizer);
      } else if (currentStream === StreamType.Synthesizer) {
        selectStream(StreamType.Visualization);
      }
    }
    // Direct selection
    else if (event.key === '1') {
      selectStream(StreamType.Visualization);
    } else if (event.key === '2') {
      selectStream(StreamType.PdfDisplay);
    } else if (event.key === '3') {
      selectStream(StreamType.Synthesizer);
    }
  }
</script>

<main>
  <div class="container">
    <div class="header">
      <div class="status-info">
        <div class="status">{status}</div>
        <div class="bluetooth-status" class:connected={isBluetoothControllerConnected}>
          Bluetooth Controller: {isBluetoothControllerConnected ? 'Connected' : 'Disconnected'}
          {#if !isBluetoothControllerConnected}
            <button class="connect-button" on:click={setupBluetoothController}>
              Connect
            </button>
          {/if}
        </div>
      </div>
      
      <div class="stream-selector">
        <button 
          class="stream-button" 
          class:active={currentStream === StreamType.Visualization}
          on:click={() => selectStream(StreamType.Visualization)}
        >
          Visualizer
        </button>
        <button 
          class="stream-button" 
          class:active={currentStream === StreamType.PdfDisplay}
          on:click={() => selectStream(StreamType.PdfDisplay)}
        >
          Sheet Music
        </button>
        <button 
          class="stream-button" 
          class:active={currentStream === StreamType.Synthesizer}
          on:click={() => selectStream(StreamType.Synthesizer)}
        >
          Synths
        </button>
      </div>
    </div>
    
    <div class="input-controls" class:hidden={currentStream !== StreamType.Visualization}>
      <div class="input-select" class:disabled={useFallbackPiano}>
        <label for="midi-input">MIDI Input:</label>
        <select 
          id="midi-input" 
          bind:value={selectedInputId} 
          on:change={handleInputChange}
          disabled={useFallbackPiano}
        >
          <option value="">Select MIDI input</option>
          {#each midiInputs as input}
            <option value={input.id}>{input.name}</option>
          {/each}
        </select>
      </div>
      
      <button class="toggle-button" on:click={toggleFallbackPiano}>
        {useFallbackPiano ? 'Disable' : 'Enable'} Virtual Piano
      </button>
    </div>
    
    {#if currentStream === StreamType.Visualization}
      <!-- Visualization Stream -->
      <div class="stream-content visualization-stream">
        {#if useFallbackPiano}
          <PianoSimulator 
            on:noteon={handleSimulatorNoteOn}
            on:noteoff={handleSimulatorNoteOff}
          />
        {/if}
      
        <div class="main-content">
          <div class="notes-container">
            {#if notesArray.length === 0}
              <div class="empty-state">No notes played yet. Try playing some notes on the piano!</div>
            {/if}
            
            {#each notesArray as note (note.id)}
              <MidiNote 
                name={note.name}
                velocity={note.velocity}
                timestamp={note.timestamp}
                fadeDuration={3000}
                inKey={note.inKey}
              />
            {/each}
          </div>
          
          <MusicAnalysis 
            musicService={musicService} 
            currentKey={currentKey}
            intervals={intervals}
            chords={chords}
            on:keyReset={handleKeyReset}
          />
        </div>
      </div>
    {:else if currentStream === StreamType.PdfDisplay}
      <!-- PDF Display Stream -->
      <div class="stream-content pdf-stream">
        <PdfStream midiInputId={selectedInputId} />
      </div>
    {:else if currentStream === StreamType.Synthesizer}
      <!-- Synthesizer Stream -->
      <div class="stream-content synth-stream">
        <SynthModule midiInputId={selectedInputId} />
      </div>
    {/if}
    
    <div class="navigation-help">
      <p>
        Use left/right arrow keys to switch between streams, or press 1, 2, 3 to select a specific stream.
        {#if isBluetoothControllerConnected}
          You can also use your 8BitDo controller to navigate.
        {/if}
      </p>
    </div>
  </div>
</main>

<style>
  main {
    font-family: Arial, sans-serif;
    background-color: #1e1e1e;
    color: #ffffff;
    margin: 0;
    padding: 20px;
    height: 100vh;
    box-sizing: border-box;
  }
  
  .container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    background-color: #2d2d2d;
    border-radius: 8px;
    margin-bottom: 15px;
  }
  
  .status-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .status {
    color: #4CAF50;
  }
  
  .bluetooth-status {
    display: flex;
    align-items: center;
    color: #ff5252;
    gap: 10px;
  }
  
  .bluetooth-status.connected {
    color: #4CAF50;
  }
  
  .connect-button {
    padding: 3px 8px;
    font-size: 12px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
  }
  
  .stream-selector {
    display: flex;
    gap: 10px;
  }
  
  .stream-button {
    padding: 8px 15px;
    background-color: #333;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .stream-button:hover {
    background-color: #444;
  }
  
  .stream-button.active {
    background-color: #4CAF50;
  }
  
  .input-controls {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
    gap: 10px;
  }
  
  .input-controls.hidden {
    display: none;
  }
  
  .input-select {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .input-select.disabled {
    opacity: 0.5;
  }
  
  select {
    padding: 8px;
    background-color: #333;
    color: white;
    border: 1px solid #555;
    border-radius: 4px;
  }
  
  .toggle-button {
    padding: 8px 12px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .toggle-button:hover {
    background-color: #3e8e41;
  }
  
  .stream-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .main-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 20px;
    overflow: hidden;
  }
  
  .notes-container {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 20px;
    background-color: #2d2d2d;
    border-radius: 8px;
    min-height: 100px;
    overflow-y: auto;
  }
  
  .empty-state {
    color: #999;
    font-style: italic;
    padding: 20px;
    text-align: center;
    width: 100%;
  }
  
  .navigation-help {
    margin-top: 15px;
    padding: 10px;
    background-color: #2d2d2d;
    border-radius: 8px;
    font-size: 14px;
    color: #ccc;
    text-align: center;
  }
</style>