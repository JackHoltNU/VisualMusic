<!-- src/svelte/SynthModule.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { WebMidi } from 'webmidi';
    import type { Input } from 'webmidi';
    import { SynthService, type SynthPreset } from './services/SynthService';
    
    // Props
    export let midiInputId: string = '';
    
    // State
    let synthService: SynthService;
    let selectedPreset: string = '';
    let presets: string[] = [];
    let masterVolume: number = 0.7;
    let activeNotes: Set<number> = new Set();
    let octaveShift: number = 0;
    
    // UI state for editing
    let isEditingPreset: boolean = false;
    let editingPresetName: string = '';
    
    // UI state for oscilloscope
    let showOscilloscope: boolean = false;
    let canvasContext: CanvasRenderingContext2D;
    let analyser: AnalyserNode;
    let dataArray: Uint8Array;
    let drawVisual: number;
    
    onMount(() => {
      // Initialize synthesizer
      synthService = new SynthService();
      presets = synthService.getPresetList();
      
      // Select first preset by default
      if (presets.length > 0) {
        selectedPreset = presets[0];
        synthService.loadPreset(selectedPreset);
      }
      
      // Get the master volume
      masterVolume = synthService.getMasterVolume();
      
      // Setup MIDI if an input is provided
      if (midiInputId) {
        setupMidiInput();
      }
      
      // Start audio context on first user interaction
      document.addEventListener('click', handleFirstInteraction, { once: true });
      document.addEventListener('keydown', handleFirstInteraction, { once: true });
      
      // Setup keyboard controls
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      
      // Setup oscilloscope
      if (showOscilloscope) {
        setupOscilloscope();
      }
    });
    
    onDestroy(() => {
      // Cleanup all playing notes
      if (synthService) {
        synthService.allNotesOff();
      }
      
      // Remove event listeners
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      
      // Cancel animation frame if oscilloscope is active
      if (drawVisual) {
        cancelAnimationFrame(drawVisual);
      }
      
      // Clean up MIDI listeners
      cleanupMidiListeners();
    });
    
    // Start audio context after user interaction
    function handleFirstInteraction() {
      if (synthService) {
        synthService.start();
      }
    }
    
    // Set up MIDI input for synthesizer
    function setupMidiInput() {
      try {
        const input = WebMidi.getInputById(midiInputId);
        if (!input) {
          console.log('Selected MIDI input not found for synth');
          return;
        }
        
        // Note On handler
        input.addListener('noteon', e => {
          const note = e.note.number;
          const velocity = e.note.attack;
          
          // Apply octave shift
          const shiftedNote = note + (octaveShift * 12);
          
          // Play note with synthesizer
          synthService.noteOn(shiftedNote, velocity);
          activeNotes.add(shiftedNote);
          activeNotes = activeNotes; // trigger update
        });
        
        // Note Off handler
        input.addListener('noteoff', e => {
          const note = e.note.number;
          
          // Apply octave shift
          const shiftedNote = note + (octaveShift * 12);
          
          // Stop note
          synthService.noteOff(shiftedNote);
          activeNotes.delete(shiftedNote);
          activeNotes = activeNotes; // trigger update
        });
        
        console.log('MIDI input set up for synth module');
        
      } catch (error) {
        console.error('Error setting up MIDI for synth:', error);
      }
    }
    
    // Clean up MIDI listeners
    function cleanupMidiListeners() {
      try {
        if (midiInputId) {
          const input = WebMidi.getInputById(midiInputId);
          if (input) {
            input.removeListener('noteon');
            input.removeListener('noteoff');
          }
        }
      } catch (error) {
        console.error('Error cleaning up MIDI listeners:', error);
      }
    }
    
    // Handle preset selection change
    function handlePresetChange() {
      if (selectedPreset) {
        synthService.loadPreset(selectedPreset);
      }
    }
    
    // Handle master volume change
    function handleVolumeChange() {
      synthService.setMasterVolume(masterVolume);
    }
    
    // Computer keyboard controls
    const keyboardMap: Record<string, number> = {
      'a': 60, // C4
      'w': 61, // C#4
      's': 62, // D4
      'e': 63, // D#4
      'd': 64, // E4
      'f': 65, // F4
      't': 66, // F#4
      'g': 67, // G4
      'y': 68, // G#4
      'h': 69, // A4
      'u': 70, // A#4
      'j': 71, // B4
      'k': 72, // C5
      'o': 73, // C#5
      'l': 74, // D5
      'p': 75, // D#5
      ';': 76, // E5
    };
    
    // Keyboard down handler
    function handleKeyDown(event: KeyboardEvent) {
      // Ignore if inside an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const key = event.key.toLowerCase();
      
      // Octave control
      if (key === 'z') {
        octaveShift = Math.max(octaveShift - 1, -3);
        return;
      } else if (key === 'x') {
        octaveShift = Math.min(octaveShift + 1, 3);
        return;
      }
      
      // Note control
      if (keyboardMap[key] && !event.repeat) {
        const note = keyboardMap[key] + (octaveShift * 12);
        synthService.noteOn(note, 0.7);
        activeNotes.add(note);
        activeNotes = activeNotes; // trigger update
      }
    }
    
    // Keyboard up handler
    function handleKeyUp(event: KeyboardEvent) {
      // Ignore if inside an input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const key = event.key.toLowerCase();
      
      if (keyboardMap[key]) {
        const note = keyboardMap[key] + (octaveShift * 12);
        synthService.noteOff(note);
        activeNotes.delete(note);
        activeNotes = activeNotes; // trigger update
      }
    }
    
    // Setup oscilloscope visualization
    function setupOscilloscope() {
      const canvas = document.getElementById('oscilloscope') as HTMLCanvasElement;
      if (!canvas) return;
      
      canvasContext = canvas.getContext('2d')!;
      
      // Create analyzer node - would need to connect this to the synth's output
      // For now, this is just a placeholder - the actual implementation would be more complex
      // and would need to connect to the synth's audio path
      const audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      canvasContext.clearRect(0, 0, canvas.width, canvas.height);
      
      function draw() {
        drawVisual = requestAnimationFrame(draw);
        
        analyser.getByteTimeDomainData(dataArray);
        
        canvasContext.fillStyle = 'rgb(30, 30, 30)';
        canvasContext.fillRect(0, 0, canvas.width, canvas.height);
        
        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = 'rgb(76, 175, 80)';
        canvasContext.beginPath();
        
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * canvas.height / 2;
          
          if (i === 0) {
            canvasContext.moveTo(x, y);
          } else {
            canvasContext.lineTo(x, y);
          }
          
          x += sliceWidth;
        }
        
        canvasContext.lineTo(canvas.width, canvas.height / 2);
        canvasContext.stroke();
      }
      
      draw();
    }
    
    // Toggle oscilloscope
    function toggleOscilloscope() {
      showOscilloscope = !showOscilloscope;
      
      if (showOscilloscope) {
        // Wait for the canvas to be available in the DOM
        setTimeout(() => {
          setupOscilloscope();
        }, 0);
      } else if (drawVisual) {
        cancelAnimationFrame(drawVisual);
      }
    }
    
    // Check if a note is active
    function isNoteActive(note: number): boolean {
      return activeNotes.has(note);
    }
  </script>
  
  <div class="synth-module">
    <div class="header">
      <h2>Synthesizer Module</h2>
      <div class="controls">
        <div class="preset-selector">
          <label for="preset-select">Preset:</label>
          <select 
            id="preset-select" 
            bind:value={selectedPreset}
            on:change={handlePresetChange}
          >
            {#each presets as preset}
              <option value={preset}>{synthService?.getPreset(preset)?.name || preset}</option>
            {/each}
          </select>
        </div>
        
        <div class="volume-control">
          <label for="master-volume">Volume:</label>
          <input 
            type="range" 
            id="master-volume" 
            min="0" 
            max="1" 
            step="0.01"
            bind:value={masterVolume}
            on:input={handleVolumeChange}
          />
          <span class="volume-value">{Math.round(masterVolume * 100)}%</span>
        </div>
        
        <div class="octave-control">
          <button on:click={() => octaveShift = Math.max(-3, octaveShift - 1)}>-</button>
          <span>Octave: {octaveShift}</span>
          <button on:click={() => octaveShift = Math.min(3, octaveShift + 1)}>+</button>
        </div>
        
        <button 
          class="oscilloscope-toggle" 
          on:click={toggleOscilloscope}
        >
          {showOscilloscope ? 'Hide' : 'Show'} Oscilloscope
        </button>
      </div>
    </div>
    
    {#if showOscilloscope}
      <div class="oscilloscope-container">
        <canvas id="oscilloscope" width="800" height="200"></canvas>
      </div>
    {/if}
    
    <div class="virtual-keyboard">
      <div class="keyboard-info">
        <p>
          Use your computer keyboard (A, W, S, E, etc.) to play notes.
          Z/X keys change octave.
        </p>
      </div>
      
      <div class="keyboard">
        <!-- White keys -->
        {#each ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'] as note, i}
          {@const noteNumber = 60 + i * 2 - (i > 2 ? 1 : 0) + (octaveShift * 12)}
          <div 
            class="key white-key" 
            class:active={isNoteActive(noteNumber)}
            on:mousedown={() => {
              synthService.noteOn(noteNumber, 0.7);
              activeNotes.add(noteNumber);
              activeNotes = activeNotes;
            }}
            on:mouseup={() => {
              synthService.noteOff(noteNumber);
              activeNotes.delete(noteNumber);
              activeNotes = activeNotes;
            }}
            on:mouseleave={() => {
              if (isNoteActive(noteNumber)) {
                synthService.noteOff(noteNumber);
                activeNotes.delete(noteNumber);
                activeNotes = activeNotes;
              }
            }}
          >
            {note}{i === 7 ? 5 : 4}
          </div>
        {/each}
        
        <!-- Black keys -->
        <div class="black-keys">
          {#each [1, 3, 0, 6, 8, 10] as offset, i}
            {@const noteNumber = 61 + offset + (octaveShift * 12)}
            <div 
              class="key black-key" 
              style="left: {i < 2 ? i * 10 + 6 : (i-2) * 10 + 36}%"
              class:active={isNoteActive(noteNumber)}
              on:mousedown={() => {
                synthService.noteOn(noteNumber, 0.7);
                activeNotes.add(noteNumber);
                activeNotes = activeNotes;
              }}
              on:mouseup={() => {
                synthService.noteOff(noteNumber);
                activeNotes.delete(noteNumber);
                activeNotes = activeNotes;
              }}
              on:mouseleave={() => {
                if (isNoteActive(noteNumber)) {
                  synthService.noteOff(noteNumber);
                  activeNotes.delete(noteNumber);
                  activeNotes = activeNotes;
                }
              }}
            >
            </div>
          {/each}
        </div>
      </div>
    </div>
    
    <div class="under-construction">
      <p>Synthesizer module is in development. More advanced controls coming soon!</p>
    </div>
  </div>
  
  <style>
    .synth-module {
      background-color: #1e1e1e;
      color: #ffffff;
      padding: 20px;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      background-color: #2d2d2d;
      padding: 15px;
      border-radius: 8px;
    }
    
    h2 {
      margin: 0;
      color: #4CAF50;
    }
    
    .controls {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    
    .preset-selector,
    .volume-control,
    .octave-control {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    select {
      background-color: #333;
      color: white;
      border: 1px solid #555;
      padding: 5px;
      border-radius: 4px;
    }
    
    input[type="range"] {
      width: 100px;
      background-color: #333;
    }
    
    .volume-value {
      width: 40px;
      text-align: right;
    }
    
    button {
      background-color: #4CAF50;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    button:hover {
      background-color: #3e8e41;
    }
    
    .oscilloscope-toggle {
      background-color: #555;
    }
    
    .oscilloscope-toggle:hover {
      background-color: #666;
    }
    
    .oscilloscope-container {
      margin-bottom: 20px;
      background-color: #2d2d2d;
      border-radius: 8px;
      padding: 10px;
      overflow: hidden;
    }
    
    canvas {
      width: 100%;
      height: 200px;
      display: block;
    }
    
    .virtual-keyboard {
      background-color: #2d2d2d;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }
    
    .keyboard-info {
      margin-bottom: 15px;
      font-size: 14px;
      color: #ccc;
    }
    
    .keyboard {
      position: relative;
      height: 150px;
      display: flex;
      margin-bottom: 10px;
    }
    
    .key {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 10px;
      transition: background-color 0.1s;
      font-size: 12px;
    }
    
    .white-key {
      background-color: white;
      border: 1px solid #555;
      flex: 1;
      height: 100%;
      border-radius: 0 0 4px 4px;
      color: #333;
      z-index: 1;
    }
    
    .white-key.active {
      background-color: #9be9a8;
    }
    
    .black-keys {
      position: absolute;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    
    .black-key {
      position: absolute;
      top: 0;
      width: 8%;
      height: 60%;
      background-color: #333;
      border-radius: 0 0 4px 4px;
      z-index: 2;
      pointer-events: auto;
    }
    
    .black-key.active {
      background-color: #666;
    }
    
    .under-construction {
      background-color: #2d2d2d;
      border-radius: 8px;
      padding: 15px;
      margin-top: auto;
      text-align: center;
      color: #999;
      font-style: italic;
    }
  </style>