<!-- src/svelte/TonalVisualization.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { NoteData, IntervalInfo, KeySignatureInfo, ChordInfo } from './services/MusicTheoryService';
    import { Note } from "@tonaljs/tonal";
    
    // Import the separate visualization modules
    import { 
      createVisualNote,
      updateVisualNote,
      noteToRadius, 
      getFunctionColor,
      getNoteFunction 
    } from './visualization/VisualNoteUtils';
    
    import {
      drawCircleOfFifthsBackground,
      drawTonalGravityBackground,
      calculateCircleOfFifthsCoordinates,
      getNotePosition
    } from './visualization/BackgroundRenderer';
    
    import {
      drawNotes,
      drawNoteLabels,
      drawIntervalLines,
      drawChordAreas,
      getIntervalThickness,
      shouldShowResolution,
      drawResolutionArrow
    } from './visualization/ElementRenderer';
    
    // Props
    export let notes: NoteData[] = [];
    export let intervals: IntervalInfo[] = [];
    export let chords: ChordInfo[] = [];
    export let currentKey: KeySignatureInfo | null = null;
    export let width: number = 800;
    export let height: number = 500;
    export let visualizationMode: 'circle-of-fifths' | 'tonal-gravity' | 'harmonic-field' = 'tonal-gravity';
    export let isMaximized: boolean = false; // Added for maximize feature
    export let vizId: string = '';
    
    // Canvas references
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    let containerDiv: HTMLDivElement;
    
    // Animation frame reference
    let animationFrame: number;
    
    // Import types from VisualNoteUtils
    import type { VisualNote, VisualChord } from './visualization/VisualNoteUtils';
    
    // Visualization state
    let visualNotes: Map<string, VisualNote> = new Map();
    let visualChords: VisualChord[] = [];
    let tonicCenterX: number = width / 2;
    let tonicCenterY: number = height / 2;
    let isReady: boolean = false;
    
    // User configurable fade duration
    let noteFadeDuration: number = 5000; // Default 5 seconds
    export let fadeDurationOption: '0' | '0.25' | '0.5' | '1' | '2' | '5' = '5'; // New prop
    
    // Circle of fifths coordinates
    let circleOfFifthsCoordinates: Map<string, {x: number, y: number}> = new Map();
    
    // Key center and scale degrees
    let keyCenter: string = "C";
    let keyMode: string = "major";
    let scaleDegrees: Map<string, number> = new Map();
    
    // Constants
    const CIRCLE_RADIUS = Math.min(width, height) * 0.35;
    
    // Dispatch events
    const dispatch = createEventDispatcher();
    
    // Update fade duration when option changes
    $: {
      // Convert option string to milliseconds
      const durationMap: Record<string, number> = {
        '0': 0,
        '0.25': 250,
        '0.5': 500,
        '1': 1000,
        '2': 2000,
        '5': 5000
      };
      noteFadeDuration = durationMap[fadeDurationOption];
    }
    
    // Initialize on mount
    onMount(() => {
      if (!canvas) return;
      
      ctx = canvas.getContext('2d')!;
      
      // Initialize circle of fifths coordinates
      circleOfFifthsCoordinates = calculateCircleOfFifthsCoordinates(tonicCenterX, tonicCenterY, CIRCLE_RADIUS);
      
      // Start animation loop
      startAnimationLoop();
      
      isReady = true;
      
      // Set initial size
      handleResize();
    });
    
    // Cleanup on destroy
    onDestroy(() => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    });
    
    // Update canvas dimensions if container size changes
    function handleResize() {
      if (canvas && containerDiv) {
        // Set canvas size based on container
        width = containerDiv.clientWidth;
        height = containerDiv.clientHeight;
        
        // Update canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Recalculate centers and coordinates
        tonicCenterX = width / 2;
        tonicCenterY = height / 2;
        circleOfFifthsCoordinates = calculateCircleOfFifthsCoordinates(tonicCenterX, tonicCenterY, CIRCLE_RADIUS);
        
        // Update all note positions
        updateNotePositions();
      }
    }
    
    // Toggle maximized state
    function toggleMaximize() {
      isMaximized = !isMaximized;
      
      // Give time for the DOM to update before adjusting sizes
      setTimeout(() => {
        handleResize();
      }, 10);
      
      // Emit event to notify parent component
      dispatch('toggleMaximize', { isMaximized, vizId });
    }
    
    // Start the animation loop
    function startAnimationLoop() {
      const loop = () => {
        draw();
        animationFrame = requestAnimationFrame(loop);
      };
      
      animationFrame = requestAnimationFrame(loop);
    }
    
    // Calculate scale degrees for the current key
    function calculateScaleDegrees(keyCenter: string, mode: string) {
      scaleDegrees.clear();
      
      try {
        import('@tonaljs/scale').then((Scale) => {
          // Get the scale notes
          const scale = Scale.get(`${keyCenter} ${mode}`);
          if (!scale.notes || scale.notes.length === 0) return;
          
          // Assign scale degrees to each note
          scale.notes.forEach((note, index) => {
            scaleDegrees.set(note, index + 1);
            
            // Handle enharmonic equivalents
            const enharmonics = getEnharmonics(note);
            enharmonics.forEach(enharmonic => {
              scaleDegrees.set(enharmonic, index + 1);
            });
          });
        });
      } catch (error) {
        console.error('Error calculating scale degrees:', error);
      }
    }
    
    // Get enharmonic equivalents of a note
    function getEnharmonics(noteName: string): string[] {
      const enharmonics: string[] = [];
      
      // Map common enharmonic pairs
      const enharmonicMap: Record<string, string[]> = {
        'C#': ['Db'],
        'Db': ['C#'],
        'D#': ['Eb'],
        'Eb': ['D#'],
        'F#': ['Gb'],
        'Gb': ['F#'],
        'G#': ['Ab'],
        'Ab': ['G#'],
        'A#': ['Bb'],
        'Bb': ['A#']
      };
      
      if (enharmonicMap[noteName]) {
        return enharmonicMap[noteName];
      }
      
      return enharmonics;
    }
    
    // Update key center and mode based on detected key
    $: {
      if (currentKey) {
        const keyNameParts = currentKey.keyName.split(' ');
        keyCenter = keyNameParts[0];
        keyMode = keyNameParts[1];
        
        // Calculate scale degrees for this key
        calculateScaleDegrees(keyCenter, keyMode);
        
        // Update the visual positions of notes
        updateNotePositions();
      }
    }
    
    // Create or update visual notes based on incoming NoteData
    $: {
      notes.forEach(note => {
        // Extract pitch class (note without octave)
        const parsed = Note.get(note.name);
        const pitchClass = parsed.pc || note.name.replace(/\d+$/, '');
        
        // Determine scale degree and function
        const scaleDegree = scaleDegrees.get(pitchClass) || null;
        const noteFunction = getNoteFunction(pitchClass, scaleDegrees);
        
        if (visualNotes.has(note.id)) {
          // Update existing visual note
          const visualNote = visualNotes.get(note.id)!;
          updateVisualNote(
            visualNote,
            note,
            pitchClass,
            scaleDegree,
            noteFunction,
            getNotePosition(
              pitchClass, 
              scaleDegree, 
              noteFunction, 
              visualizationMode, 
              circleOfFifthsCoordinates,
              tonicCenterX,
              tonicCenterY,
              CIRCLE_RADIUS
            )
          );
        } else {
          // Create new visual note
          const position = getNotePosition(
            pitchClass, 
            scaleDegree, 
            noteFunction,
            visualizationMode,
            circleOfFifthsCoordinates,
            tonicCenterX,
            tonicCenterY,
            CIRCLE_RADIUS
          );
          
          const visualNote = createVisualNote(
            note, 
            pitchClass, 
            scaleDegree, 
            noteFunction, 
            position
          );
          
          visualNotes.set(note.id, visualNote);
        }
      });
    }
    
    // Update visual chord representations
    $: {
      // Clear existing chords
      visualChords = [];
      
      // Process each chord
      chords.forEach((chord, index) => {
        // Calculate chord center as average of note positions
        let centerX = 0;
        let centerY = 0;
        let noteCount = 0;
        let chordNotes: string[] = [];
        
        // Get all notes in this chord
        notes.forEach(note => {
          const parsed = Note.get(note.name);
          const pitchClass = parsed.pc || note.name.replace(/\d+$/, '');
          
          if (chord.notes.includes(pitchClass)) {
            const visualNote = getVisualNoteByPitchClass(pitchClass);
            if (visualNote) {
              centerX += visualNote.x;
              centerY += visualNote.y;
              noteCount++;
              chordNotes.push(visualNote.id);
              
              // Update note to show it's part of this chord
              visualNote.chordTones.push(chord.name);
            }
          }
        });
        
        if (noteCount > 0) {
          centerX /= noteCount;
          centerY /= noteCount;
          
          // Determine chord function
          let chordFunction = 'other';
          let rootScaleDegree = null;
          
          if (chord.romanNumeral) {
            if (['I', 'i'].includes(chord.romanNumeral)) chordFunction = 'tonic';
            else if (['V', 'v', 'V7', 'vii°'].includes(chord.romanNumeral)) chordFunction = 'dominant';
            else if (['IV', 'iv', 'ii', 'ii°'].includes(chord.romanNumeral)) chordFunction = 'subdominant';
            else if (['III', 'iii', 'VI', 'vi'].includes(chord.romanNumeral)) chordFunction = 'mediant';
            
            // Extract root scale degree from roman numeral
            const degreeMap: Record<string, number> = {'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7};
            const base = chord.romanNumeral.toLowerCase().replace(/[°+7]/, '');
            rootScaleDegree = base in degreeMap ? degreeMap[base as keyof typeof degreeMap] : null;
          }
          
          // Calculate chord radius based on contained notes
          const radius = Math.max(60, 30 * noteCount);
          
          // Color based on function
          const FUNCTION_COLORS = {
            tonic: 'hsl(200, 90%, 60%)',        // Blue
            dominant: 'hsl(0, 90%, 60%)',        // Red
            subdominant: 'hsl(120, 70%, 60%)',   // Green
            mediant: 'hsl(270, 70%, 60%)',       // Purple
            other: 'hsl(0, 0%, 60%)'             // Gray
          };
          
          const color = FUNCTION_COLORS[chordFunction as keyof typeof FUNCTION_COLORS] || FUNCTION_COLORS.other;
          
          visualChords.push({
            id: `chord-${index}`,
            notes: chordNotes,
            centerX,
            centerY,
            radius,
            color,
            opacity: 0.3,
            name: chord.name,
            function: chordFunction,
            rootScaleDegree
          });
        }
      });
    }
    
    // Update positions of all notes based on current mode
    function updateNotePositions() {
      visualNotes.forEach(note => {
        const newPos = getNotePosition(
          note.pitchClass, 
          note.scaleDegree, 
          note.function,
          visualizationMode,
          circleOfFifthsCoordinates,
          tonicCenterX,
          tonicCenterY,
          CIRCLE_RADIUS
        );
        note.targetX = newPos.x;
        note.targetY = newPos.y;
      });
    }
    
    // Helper to find a visual note by pitch class
    function getVisualNoteByPitchClass(pitchClass: string): VisualNote | undefined {
      for (const note of visualNotes.values()) {
        if (note.pitchClass === pitchClass && note.opacity > 0.5) {
          return note;
        }
      }
      return undefined;
    }
    
    // Helper to find a visual note by note name
    function findVisualNoteByName(noteName: string): VisualNote | undefined {
      // Find the note based on the full note name
      for (const note of visualNotes.values()) {
        if (note.name === noteName && note.opacity > 0.5) {
          return note;
        }
      }
      return undefined;
    }
    
    // Update opacity and position of notes
    function updateNoteStates() {
      const now = Date.now();
      const notesToRemove: string[] = [];
      
      visualNotes.forEach((note, id) => {
        // Update positions with smooth animation
        const dx = note.targetX - note.x;
        const dy = note.targetY - note.y;
        note.x += dx * 0.1;
        note.y += dy * 0.1;
        
        if (!note.active) {
          // Calculate opacity based on timestamp for inactive notes
          const elapsed = now - note.timestamp;
          
          // Handle special case for 0 seconds (immediate removal)
          if (noteFadeDuration === 0) {
            notesToRemove.push(id);
          } else if (elapsed > noteFadeDuration) {
            notesToRemove.push(id);
          } else {
            note.opacity = 1 - (elapsed / noteFadeDuration);
          }
        }
      });
      
      // Remove old notes
      notesToRemove.forEach(id => {
        visualNotes.delete(id);
      });
    }
    
    // Draw main visualization
    function draw() {
      if (!ctx || !isReady) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Draw background elements based on mode
      if (visualizationMode === 'circle-of-fifths') {
        drawCircleOfFifthsBackground(
          ctx, 
          circleOfFifthsCoordinates, 
          tonicCenterX,
          tonicCenterY,
          CIRCLE_RADIUS,
          currentKey,
          keyCenter, 
          keyMode,
          scaleDegrees
        );
      } else if (visualizationMode === 'tonal-gravity') {
        drawTonalGravityBackground(
          ctx,
          tonicCenterX,
          tonicCenterY,
          CIRCLE_RADIUS,
          currentKey,
          keyCenter, 
          keyMode
        );
      }
      
      // Update note states and animations
      updateNoteStates();
      
      // Draw chord areas
      drawChordAreas(ctx, visualChords);
      
      // Draw connection lines for intervals
      drawIntervalLines(
        ctx, 
        intervals, 
        visualNotes, 
        findVisualNoteByName, 
        currentKey, 
        keyCenter, 
        keyMode
      );
      
      // Draw notes
      drawNotes(ctx, visualNotes);
      
      // Draw scales degrees or note names
      drawNoteLabels(ctx, visualNotes);
    }
    
    // Switch visualization mode
    export function setVisualizationMode(mode: 'circle-of-fifths' | 'tonal-gravity' | 'harmonic-field') {
      visualizationMode = mode;
      updateNotePositions();
    }
  </script>
  
  <svelte:window on:resize={handleResize} />
  
  <div 
    class="visualization-container" 
    class:maximized={isMaximized}
    bind:this={containerDiv}
  >
    <div class="header">
      <div class="visualization-controls">
        <label>
          <input 
            type="radio" 
            name="viz-mode" 
            value="circle-of-fifths" 
            bind:group={visualizationMode} 
            on:change={updateNotePositions}
          />
          Circle of Fifths
        </label>
        
        <label>
          <input 
            type="radio" 
            name="viz-mode" 
            value="tonal-gravity" 
            bind:group={visualizationMode}
            on:change={updateNotePositions}
          />
          Tonal Gravity
        </label>
        
        <label>
          Fade Duration:
          <select bind:value={fadeDurationOption}>
            <option value="0">0 seconds</option>
            <option value="0.25">0.25 seconds</option>
            <option value="0.5">0.5 seconds</option>
            <option value="1">1 second</option>
            <option value="2">2 seconds</option>
            <option value="5">5 seconds</option>
          </select>
        </label>
      </div>
      
      <button 
        class="maximize-button" 
        on:click={toggleMaximize}
        title={isMaximized ? "Restore size" : "Maximize"}
      >
        {isMaximized ? '↙' : '↗'}
      </button>
    </div>
    
    <div class="canvas-wrapper">
      <canvas 
        bind:this={canvas} 
        width={width} 
        height={height}
        class="note-visualization"
      ></canvas>
    </div>
  </div>
  
  <style>
    .visualization-container {
      width: 100%;
      height: 100%;
      background-color: #1a1a1a;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;
    }
    
    /* Maximized state styles */
    .visualization-container.maximized {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 1000;
      border-radius: 0;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 15px;
      background-color: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(5px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .visualization-controls {
      display: flex;
      gap: 15px;
      align-items: center;
      flex-wrap: wrap;
    }
    
    .visualization-controls label {
      color: white;
      display: flex;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .visualization-controls input[type="radio"] {
      cursor: pointer;
    }
    
    .visualization-controls select {
      background-color: #333;
      color: white;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 3px 6px;
      cursor: pointer;
    }
    
    .maximize-button {
      background-color: transparent;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 4px;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      transition: background-color 0.2s ease;
    }
    
    .maximize-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .canvas-wrapper {
      flex: 1;
      overflow: auto;
      position: relative;
    }
    
    .note-visualization {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>