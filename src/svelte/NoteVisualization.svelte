<!-- src/svelte/NoteVisualization.svelte -->
<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import type { NoteData, IntervalInfo } from './services/MusicTheoryService';
    
    // Props
    export let notes: NoteData[] = [];
    export let intervals: IntervalInfo[] = [];
    export let width: number = 800;
    export let height: number = 500;
    
    // Canvas references
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;
    
    // Animation frame reference
    let animationFrame: number;
    
    // Note visualization data
    interface VisualNote {
      id: string;
      x: number;
      y: number;
      radius: number;
      color: string;
      opacity: number;
      velocity: number;
      timestamp: number;
      active: boolean;
    }
    
    // Mapping of note IDs to their visual representation
    let visualNotes: Map<string, VisualNote> = new Map();
    
    // Dispatch events
    const dispatch = createEventDispatcher();
    
    // Constants
    const NOTE_LIFESPAN = 5000; // How long inactive notes remain visible (ms)
    const MIN_RADIUS = 8;
    const MAX_RADIUS = 30;
    const MIN_MIDI = 21; // A0
    const MAX_MIDI = 108; // C8
    
    // Initialize on mount
    onMount(() => {
      if (!canvas) return;
      
      ctx = canvas.getContext('2d')!;
      
      // Start animation loop
      startAnimationLoop();
    });
    
    // Cleanup on destroy
    onDestroy(() => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    });
    
    // Start the animation loop
    function startAnimationLoop() {
      const loop = () => {
        draw();
        animationFrame = requestAnimationFrame(loop);
      };
      
      animationFrame = requestAnimationFrame(loop);
    }
    
    // Map MIDI note number to hue (color)
    function noteToHue(midiNumber: number): number {
      // Map to a color wheel (0-360)
      // Using modulo 12 to map to pitch class (C, C#, D, etc.)
      return (midiNumber % 12) * 30;
    }
    
    // Map MIDI note number to radius (size)
    function noteToRadius(midiNumber: number): number {
      // Lower notes are larger
      const normalizedNote = Math.max(0, Math.min(1, (MAX_MIDI - midiNumber) / (MAX_MIDI - MIN_MIDI)));
      return MIN_RADIUS + normalizedNote * (MAX_RADIUS - MIN_RADIUS);
    }
    
    // Map velocity to color brightness
    function velocityToBrightness(velocity: number): number {
      // Higher velocity = brighter
      return 40 + velocity * 50; // Range 40-90%
    }
    
    // Generate a random position for a new note
    function generateNotePosition(radius: number): { x: number, y: number } {
      // Add some padding to avoid edges
      const padding = MAX_RADIUS;
      
      // Try to find a position that doesn't overlap too much with existing notes
      const MAX_ATTEMPTS = 10;
      let bestPosition = { x: 0, y: 0 };
      let minOverlap = Infinity;
      
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const x = padding + Math.random() * (width - 2 * padding);
        const y = padding + Math.random() * (height - 2 * padding);
        
        let totalOverlap = 0;
        
        // Check overlap with existing notes
        for (const note of visualNotes.values()) {
          const dx = x - note.x;
          const dy = y - note.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = radius + note.radius;
          
          if (distance < minDistance) {
            totalOverlap += (minDistance - distance);
          }
        }
        
        if (totalOverlap < minOverlap) {
          minOverlap = totalOverlap;
          bestPosition = { x, y };
          
          // If we found a non-overlapping position, break early
          if (totalOverlap === 0) break;
        }
      }
      
      return bestPosition;
    }
    
    // Map interval consonance to line thickness
    function intervalToThickness(interval: IntervalInfo): number {
      // More consonant intervals get thicker lines
      // Based on traditional consonance ratings
      const intervalMap: Record<string, number> = {
        '1P': 4, // Unison
        '8P': 4, // Octave
        '5P': 3, // Perfect fifth
        '4P': 3, // Perfect fourth
        '3M': 2.5, // Major third
        '6M': 2.5, // Major sixth
        '3m': 2, // Minor third
        '6m': 2, // Minor sixth
        '2M': 1.5, // Major second
        '7m': 1.5, // Minor seventh
        '2m': 1, // Minor second
        '7M': 1, // Major seventh
        '4A': 1, // Augmented fourth
        '5d': 1  // Diminished fifth
      };
      
      return intervalMap[interval.name] || 1;
    }
    
    // Create/update visual notes based on incoming NoteData
    $: {
      notes.forEach(note => {
        if (visualNotes.has(note.id)) {
          // Update existing visual note
          const visualNote = visualNotes.get(note.id)!;
          visualNote.active = note.active;
          visualNote.timestamp = note.timestamp;
          visualNote.opacity = 1;
        } else {
          // Create new visual note
          const radius = noteToRadius(note.midiNumber);
          const position = generateNotePosition(radius);
          const hue = noteToHue(note.midiNumber);
          
          visualNotes.set(note.id, {
            id: note.id,
            x: position.x,
            y: position.y,
            radius,
            color: `hsl(${hue}, 80%, ${velocityToBrightness(note.velocity)}%)`,
            opacity: 1,
            velocity: note.velocity,
            timestamp: note.timestamp,
            active: note.active
          });
        }
      });
    }
    
    // Main drawing function
    function draw() {
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Update note opacities and remove old notes
      const now = Date.now();
      const notesToRemove: string[] = [];
      
      visualNotes.forEach((note, id) => {
        if (!note.active) {
          // Calculate opacity based on timestamp for inactive notes
          const elapsed = now - note.timestamp;
          if (elapsed > NOTE_LIFESPAN) {
            notesToRemove.push(id);
          } else {
            note.opacity = 1 - (elapsed / NOTE_LIFESPAN);
          }
        }
      });
      
      // Remove old notes
      notesToRemove.forEach(id => {
        visualNotes.delete(id);
      });
      
      // Draw connection lines for intervals
      drawIntervalLines();
      
      // Draw notes
      drawNotes();
    }
    
    // Draw all notes
    function drawNotes() {
      visualNotes.forEach(note => {
        ctx.globalAlpha = note.opacity;
        
        // Draw note circle
        ctx.beginPath();
        ctx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);
        ctx.fillStyle = note.color;
        ctx.fill();
        
        // Draw outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw active indicator if the note is active
        if (note.active) {
          ctx.beginPath();
          ctx.arc(note.x, note.y, note.radius * 1.2, 0, 2 * Math.PI);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });
      
      // Reset opacity
      ctx.globalAlpha = 1;
    }
    
    // Draw connecting lines for intervals
    function drawIntervalLines() {
      intervals.forEach(interval => {
        // Get the two notes forming this interval
        const [note1Name, note2Name] = interval.noteNames;
        
        // Find the corresponding visual notes
        const visualNote1 = findVisualNoteByName(note1Name);
        const visualNote2 = findVisualNoteByName(note2Name);
        
        if (visualNote1 && visualNote2) {
          // Calculate line opacity as the minimum of both note opacities
          const lineOpacity = Math.min(visualNote1.opacity, visualNote2.opacity);
          
          // Create gradient between the two note colors
          const gradient = ctx.createLinearGradient(
            visualNote1.x, visualNote1.y, 
            visualNote2.x, visualNote2.y
          );
          gradient.addColorStop(0, visualNote1.color);
          gradient.addColorStop(1, visualNote2.color);
          
          // Draw the line
          ctx.beginPath();
          ctx.moveTo(visualNote1.x, visualNote1.y);
          ctx.lineTo(visualNote2.x, visualNote2.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = intervalToThickness(interval) * 2;
          ctx.globalAlpha = lineOpacity * 0.7; // Make lines slightly transparent
          ctx.stroke();
        }
      });
      
      // Reset opacity
      ctx.globalAlpha = 1;
    }
    
    // Helper to find a visual note by note name
    function findVisualNoteByName(noteName: string): VisualNote | undefined {
      // This requires matching note name to the ID in visualNotes
      // We'll do a simple search since we don't have a direct mapping
      for (const note of visualNotes.values()) {
        const foundNote = notes.find(n => n.id === note.id && n.name === noteName);
        if (foundNote) {
          return note;
        }
      }
      return undefined;
    }
    
    // Resize handler
    function handleResize() {
      if (canvas) {
        // Update canvas dimensions if container size changes
        const container = canvas.parentElement;
        if (container) {
          width = container.clientWidth;
          height = container.clientHeight;
        }
      }
    }
  </script>
  
  <svelte:window on:resize={handleResize} />
  
  <div class="visualization-container">
    <canvas 
      bind:this={canvas} 
      width={width} 
      height={height}
      class="note-visualization"
    ></canvas>
  </div>
  
  <style>
    .visualization-container {
      width: 100%;
      height: 100%;
      background-color: #1a1a1a;
      border-radius: 8px;
      overflow: hidden;
    }
    
    .note-visualization {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>