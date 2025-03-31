// src/svelte/visualization/VisualNoteUtils.ts
import type { NoteData } from "../services/MusicTheoryService";

// Visual note representation
export interface VisualNote {
  id: string;
  name: string;
  pitchClass: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  color: string;
  opacity: number;
  velocity: number;
  timestamp: number;
  active: boolean;
  inKey: boolean;
  scaleDegree: number | null;
  function: "tonic" | "dominant" | "subdominant" | "mediant" | "other";
  chordTones: string[];
}

// Visual representation of a chord
export interface VisualChord {
  id: string;
  notes: string[];
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
  opacity: number;
  name: string;
  function: string;
  rootScaleDegree: number | null;
}

// Constants
const MIN_RADIUS = 15;
const MAX_RADIUS = 45;
const MIN_MIDI = 21; // A0
const MAX_MIDI = 108; // C8

// Color palettes
export const FUNCTION_COLORS = {
  tonic: "hsl(200, 90%, 60%)", // Blue
  dominant: "hsl(0, 90%, 60%)", // Red
  subdominant: "hsl(120, 70%, 60%)", // Green
  mediant: "hsl(270, 70%, 60%)", // Purple
  other: "hsl(0, 0%, 60%)", // Gray
};

// Create a new visual note
export function createVisualNote(
  note: NoteData,
  pitchClass: string,
  scaleDegree: number | null,
  noteFunction: "tonic" | "dominant" | "subdominant" | "mediant" | "other",
  position: { x: number; y: number }
): VisualNote {
  const radius = noteToRadius(note.midiNumber, note.inKey, note.active);
  const color = getFunctionColor(noteFunction, note.inKey, scaleDegree);

  return {
    id: note.id,
    name: note.name,
    pitchClass,
    x: position.x,
    y: position.y,
    targetX: position.x,
    targetY: position.y,
    radius,
    color,
    opacity: 1,
    velocity: note.velocity,
    timestamp: note.timestamp,
    active: note.active,
    inKey: note.inKey,
    scaleDegree,
    function: noteFunction,
    chordTones: [],
  };
}

// Update an existing visual note
export function updateVisualNote(
  visualNote: VisualNote,
  note: NoteData,
  pitchClass: string,
  scaleDegree: number | null,
  noteFunction: "tonic" | "dominant" | "subdominant" | "mediant" | "other",
  position: { x: number; y: number }
): void {
  visualNote.active = note.active;
  visualNote.timestamp = note.timestamp;
  visualNote.opacity = 1;
  visualNote.inKey = note.inKey;
  visualNote.scaleDegree = scaleDegree;
  visualNote.function = noteFunction;
  visualNote.radius = noteToRadius(note.midiNumber, note.inKey, note.active);
  visualNote.color = getFunctionColor(noteFunction, note.inKey, scaleDegree);

  // Update position target (note will animate toward this)
  visualNote.targetX = position.x;
  visualNote.targetY = position.y;
  visualNote.pitchClass = pitchClass;
  visualNote.chordTones = [];
}

// Map MIDI note number to radius (size)
export function noteToRadius(
  midiNumber: number,
  isInKey: boolean,
  isActive: boolean
): number {
  // Base radius calculation - lower notes are larger
  const normalizedNote = Math.max(
    0,
    Math.min(1, (MAX_MIDI - midiNumber) / (MAX_MIDI - MIN_MIDI))
  );
  let radius = MIN_RADIUS + normalizedNote * (MAX_RADIUS - MIN_RADIUS);

  // Adjust radius based on note properties
  if (!isInKey) radius *= 0.8; // Non-key notes are smaller
  if (isActive) radius *= 1.2; // Active notes are larger

  return radius;
}

// Get color based on note function
export function getFunctionColor(
  noteFunction: string,
  inKey: boolean,
  scaleDegree: number | null
): string {
  if (!inKey) return "hsl(0, 0%, 50%)"; // Gray for notes outside the key

  const baseColor =
    FUNCTION_COLORS[noteFunction as keyof typeof FUNCTION_COLORS] ||
    FUNCTION_COLORS.other;

  // For 'other' notes that are in the key, shade by scale degree
  if (noteFunction === "other" && scaleDegree !== null) {
    const hue = ((scaleDegree - 1) * 30) % 360;
    return `hsl(${hue}, 60%, 60%)`;
  }

  return baseColor;
}

// Determine note function within key
export function getNoteFunction(
  pitchClass: string,
  scaleDegrees: Map<string, number>
): "tonic" | "dominant" | "subdominant" | "mediant" | "other" {
  if (!scaleDegrees.has(pitchClass)) return "other";

  const degree = scaleDegrees.get(pitchClass);

  switch (degree) {
    case 1:
      return "tonic";
    case 5:
      return "dominant";
    case 4:
      return "subdominant";
    case 3:
    case 6:
      return "mediant";
    default:
      return "other";
  }
}
