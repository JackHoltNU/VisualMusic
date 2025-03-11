<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    // Define key types and layout
    const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    const blackKeys = ['C#', 'D#', 'F#', 'G#', 'A#'];
    const blackKeyPositions = [0, 1, 3, 4, 5]; // Positions after white keys (0-indexed)
    
    // Generate a range of octaves
    export let startOctave = 3;
    export let endOctave = 5;
    
    const dispatch = createEventDispatcher();
    
    // Define the type for note names
    type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
    
    // Use Record utility type to create a mapping from NoteName to number
    const noteMap: Record<NoteName, number> = { 
      'C': 0, 
      'C#': 1, 
      'D': 2, 
      'D#': 3, 
      'E': 4, 
      'F': 5, 
      'F#': 6, 
      'G': 7, 
      'G#': 8, 
      'A': 9, 
      'A#': 10, 
      'B': 11 
    };
    
    // Maps key to MIDI note number
    function getMidiNoteNumber(note: NoteName, octave: number): number {
      return (octave + 1) * 12 + noteMap[note];
    }
    
    // Generate note on event
    function noteOn(note: NoteName, octave: number) {
      try {
        const midiNumber = getMidiNoteNumber(note, octave);
        console.log(`Note ON: ${note}${octave} (MIDI: ${midiNumber})`);
        
        dispatch('noteon', { 
          note: {
            number: midiNumber,
            name: note,
            octave: octave
          },
          velocity: 0.75
        });
      } catch (error) {
        console.error('Error in noteOn:', error);
      }
    }
    
    // Generate note off event
    function noteOff(note: NoteName, octave: number) {
      try {
        const midiNumber = getMidiNoteNumber(note, octave);
        console.log(`Note OFF: ${note}${octave} (MIDI: ${midiNumber})`);
        
        dispatch('noteoff', { 
          note: {
            number: midiNumber,
            name: note,
            octave: octave
          },
          velocity: 0
        });
      } catch (error) {
        console.error('Error in noteOff:', error);
      }
    }
    
    // Handle mouse interactions
    function handleMouseDown(note: NoteName | string, octave: number) {
      console.log(`Mouse down on: ${note}${octave}`);
      noteOn(note as NoteName, octave);
    }
    
    function handleMouseUp(note: NoteName | string, octave: number) {
      console.log(`Mouse up on: ${note}${octave}`);
      noteOff(note as NoteName, octave);
    }
    
    function handleMouseLeave(note: NoteName | string, octave: number) {
      console.log(`Mouse leave on: ${note}${octave}`);
      noteOff(note as NoteName, octave);
    }
    
    // Handle keyboard events
    const keyboardMap: Record<string, {note: NoteName, octave: number}> = {
      'a': { note: 'C', octave: 3 },
      'w': { note: 'C#', octave: 3 },
      's': { note: 'D', octave: 3 },
      'e': { note: 'D#', octave: 3 },
      'd': { note: 'E', octave: 3 },
      'f': { note: 'F', octave: 3 },
      't': { note: 'F#', octave: 3 },
      'g': { note: 'G', octave: 3 },
      'y': { note: 'G#', octave: 3 },
      'h': { note: 'A', octave: 3 },
      'u': { note: 'A#', octave: 3 },
      'j': { note: 'B', octave: 3 },
      'k': { note: 'C', octave: 4 },
      'o': { note: 'C#', octave: 4 },
      'l': { note: 'D', octave: 4 },
      'p': { note: 'D#', octave: 4 },
      ';': { note: 'E', octave: 4 },
    };
    
    const activeKeys = new Set();
    
    function handleKeyDown(event: { key: string; repeat: any; }) {
      try {
        console.log(`Key down: ${event.key}`);
        if (event.repeat) return; // Prevent repeat events
        
        const key = event.key.toLowerCase();
        if (keyboardMap[key] && !activeKeys.has(key)) {
          activeKeys.add(key);
          const { note, octave } = keyboardMap[key];
          noteOn(note, octave);
        }
      } catch (error) {
        console.error('Error in handleKeyDown:', error);
      }
    }
    
    function handleKeyUp(event: { key: string; }) {
      try {
        console.log(`Key up: ${event.key}`);
        const key = event.key.toLowerCase();
        if (keyboardMap[key]) {
          activeKeys.delete(key);
          const { note, octave } = keyboardMap[key];
          noteOff(note, octave);
        }
      } catch (error) {
        console.error('Error in handleKeyUp:', error);
      }
    }
  </script>
  
  <svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />
  
  <div class="piano-simulator">
    <div class="piano-keyboard">
      {#each Array(endOctave - startOctave + 1) as _, octaveIndex}
        {@const octave = startOctave + octaveIndex}
        <div class="octave">
          <!-- White keys -->
          {#each whiteKeys as note}
            <div 
              class="key white-key" 
              on:mousedown={() => handleMouseDown(note, octave)}
              on:mouseup={() => handleMouseUp(note, octave)}
              on:mouseleave={() => handleMouseLeave(note, octave)}
            >
              <span class="key-label">{note}{octave}</span>
            </div>
          {/each}
          
          <!-- Black keys (overlay) -->
          <div class="black-keys-container">
            {#each blackKeyPositions as position, index}
              {@const note = blackKeys[index]}
              <div 
                class="key black-key" 
                style="left: {position * 14 + 10}%"
                on:mousedown={() => handleMouseDown(note, octave)}
                on:mouseup={() => handleMouseUp(note, octave)}
                on:mouseleave={() => handleMouseLeave(note, octave)}
              >
                <span class="key-label">{note}{octave}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    
    <div class="keyboard-instructions">
      <p>Use your mouse or keyboard (A-L and W-P) to play notes</p>
    </div>
  </div>
  
  <style>
    .piano-simulator {
      margin-top: 20px;
      border-radius: 4px;
      background-color: #333;
      padding: 10px;
    }
    
    .piano-keyboard {
      display: flex;
      height: 150px;
      position: relative;
    }
    
    .octave {
      display: flex;
      position: relative;
      flex: 1;
    }
    
    .key {
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 5px;
      transition: background-color 0.1s;
    }
    
    .white-key {
      background-color: white;
      border: 1px solid #333;
      border-radius: 0 0 3px 3px;
      flex: 1;
      color: #333;
      z-index: 1;
    }
    
    .white-key:active {
      background-color: #e0e0e0;
    }
    
    .black-keys-container {
      position: absolute;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    
    .black-key {
      background-color: #111;
      position: absolute;
      width: 8%;
      height: 65%;
      border-radius: 0 0 3px 3px;
      z-index: 2;
      pointer-events: auto;
      color: white;
    }
    
    .black-key:active {
      background-color: #333;
    }
    
    .key-label {
      font-size: 10px;
      opacity: 0.7;
    }
    
    .keyboard-instructions {
      color: #ccc;
      font-size: 14px;
      text-align: center;
      margin-top: 10px;
    }
  </style>