<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { WebMidi } from 'webmidi';
    import type { Input } from 'webmidi';
    import MidiNote from './MidiNote.svelte';
    import PianoSimulator from './PianoSimulator.svelte';
    import MusicAnalysis from './MusicAnalysis.svelte';
    import { MusicTheoryService, type NoteData, type KeySignatureInfo, type IntervalInfo, type ChordInfo } from './services/MusicTheoryService';
  
    // State
    let status: string = 'Initializing WebMidi...';
    let midiInputs: Input[] = [];
    let selectedInputId: string = '';
    let activeNotes: Map<string, NoteData> = new Map();
    let notesArray: NoteData[] = [];
    let useFallbackPiano: boolean = false;
    
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
    });
    
    // Handle input selection change
    function handleInputChange() {
      if (selectedInputId && !useFallbackPiano) {
        setupMidiInput(selectedInputId);
      }
    }
  </script>
  
  <main>
    <div class="container">
      <div class="controls">
        <div class="status">{status}</div>
        
        <div class="input-controls">
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
        
        {#if useFallbackPiano}
          <PianoSimulator 
            on:noteon={handleSimulatorNoteOn}
            on:noteoff={handleSimulatorNoteOff}
          />
        {/if}
      </div>
      
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
    
    .controls {
      margin-bottom: 20px;
    }
    
    .status {
      margin-bottom: 10px;
      color: #4CAF50;
    }
    
    .input-controls {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      gap: 10px;
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
  </style>