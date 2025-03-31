// src/svelte/visualization/ElementRenderer.ts
import type {
  IntervalInfo,
  KeySignatureInfo,
} from "../services/MusicTheoryService";
import type { VisualNote, VisualChord } from "./VisualNoteUtils";
import { Note } from "@tonaljs/tonal";

// Draw notes
export function drawNotes(
  ctx: CanvasRenderingContext2D,
  visualNotes: Map<string, VisualNote>
): void {
  // Sort notes by radius so larger notes are drawn first (appear behind)
  const sortedNotes = Array.from(visualNotes.values()).sort(
    (a, b) => b.radius - a.radius
  );

  sortedNotes.forEach((note) => {
    ctx.globalAlpha = note.opacity;

    // Draw note circle
    ctx.beginPath();
    ctx.arc(note.x, note.y, note.radius, 0, 2 * Math.PI);
    ctx.fillStyle = note.color;
    ctx.fill();

    // Draw outline
    ctx.strokeStyle = note.active
      ? "rgba(255, 255, 255, 0.8)"
      : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = note.active ? 3 : 1;
    ctx.stroke();

    // Draw chord indicator if this note is part of active chords
    if (note.chordTones.length > 0) {
      ctx.beginPath();
      ctx.arc(note.x, note.y, note.radius * 1.2, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  // Reset opacity
  ctx.globalAlpha = 1;
}

// Draw labels for notes
export function drawNoteLabels(
  ctx: CanvasRenderingContext2D,
  visualNotes: Map<string, VisualNote>
): void {
  visualNotes.forEach((note) => {
    // Only draw labels for notes with sufficient opacity
    if (note.opacity < 0.4) return;

    ctx.globalAlpha = note.opacity;
    ctx.fillStyle = "white";
    ctx.font = note.active ? "bold 14px Arial" : "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw note name
    ctx.fillText(note.pitchClass, note.x, note.y);

    // If the note has a scale degree, show it
    if (note.scaleDegree !== null) {
      ctx.font = "10px Arial";
      ctx.fillText(`${note.scaleDegree}`, note.x, note.y + 15);
    }
  });

  // Reset opacity
  ctx.globalAlpha = 1;
}

// Draw chord areas
export function drawChordAreas(
  ctx: CanvasRenderingContext2D,
  visualChords: VisualChord[]
): void {
  visualChords.forEach((chord) => {
    // Draw circle for chord area
    ctx.beginPath();
    ctx.globalAlpha = chord.opacity;
    ctx.arc(chord.centerX, chord.centerY, chord.radius, 0, 2 * Math.PI);
    ctx.fillStyle = chord.color;
    ctx.fill();

    // Draw chord name
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(chord.name, chord.centerX, chord.centerY);

    // If it has a roman numeral function, display it
    if (chord.rootScaleDegree !== null) {
      ctx.font = "14px Arial";
      ctx.fillText(
        `(${romanNumeralFromDegree(chord.rootScaleDegree)})`,
        chord.centerX,
        chord.centerY + 20
      );
    }
  });

  ctx.globalAlpha = 1;
}

// Convert scale degree to roman numeral
function romanNumeralFromDegree(degree: number): string {
  const numerals = ["I", "II", "III", "IV", "V", "VI", "VII"];
  return numerals[degree - 1] || "";
}

// Draw connecting lines for intervals
export function drawIntervalLines(
  ctx: CanvasRenderingContext2D,
  intervals: IntervalInfo[],
  visualNotes: Map<string, VisualNote>,
  findVisualNoteByName: (noteName: string) => VisualNote | undefined,
  currentKey: KeySignatureInfo | null,
  keyCenter: string,
  keyMode: string
): void {
  // Draw lines between notes that form intervals
  intervals.forEach((interval) => {
    // Get the two notes forming this interval
    const [note1Name, note2Name] = interval.noteNames;

    // Find the corresponding visual notes
    const visualNote1 = findVisualNoteByName(note1Name);
    const visualNote2 = findVisualNoteByName(note2Name);

    if (visualNote1 && visualNote2) {
      // Calculate line opacity as the minimum of both note opacities
      const lineOpacity = Math.min(visualNote1.opacity, visualNote2.opacity);

      // Get interval consonance for line thickness
      const thickness = getIntervalThickness(interval);

      // Create gradient between the two note colors
      const gradient = ctx.createLinearGradient(
        visualNote1.x,
        visualNote1.y,
        visualNote2.x,
        visualNote2.y
      );
      gradient.addColorStop(0, visualNote1.color);
      gradient.addColorStop(1, visualNote2.color);

      // Draw the line
      ctx.beginPath();
      ctx.moveTo(visualNote1.x, visualNote1.y);
      ctx.lineTo(visualNote2.x, visualNote2.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = thickness;
      ctx.globalAlpha = lineOpacity * 0.7; // Make lines slightly transparent
      ctx.stroke();

      // For resolving intervals (like dominant to tonic), draw an arrow
      if (shouldShowResolution(interval, currentKey, keyCenter, keyMode)) {
        drawResolutionArrow(
          ctx,
          visualNote1,
          visualNote2,
          gradient,
          lineOpacity,
          currentKey
        );
      }
    }
  });

  // Reset opacity
  ctx.globalAlpha = 1;
}

// Determine if an interval should show resolution direction
export function shouldShowResolution(
  interval: IntervalInfo,
  currentKey: KeySignatureInfo | null,
  keyCenter: string,
  keyMode: string
): boolean {
  // Leading tone to tonic resolution
  if (interval.name === "2m" && interval.noteNames) {
    const [note1, note2] = interval.noteNames;
    const pc1 = Note.get(note1).pc;
    const pc2 = Note.get(note2).pc;

    if (currentKey && currentKey.notes.length > 0) {
      const tonic = currentKey.notes[0];
      const leadingTone =
        keyMode === "major"
          ? Note.transpose(tonic, "7M")
          : Note.transpose(tonic, "7m");

      return (
        (pc1 === leadingTone && pc2 === tonic) ||
        (pc2 === leadingTone && pc1 === tonic)
      );
    }
  }

  // Dominant to tonic resolution (V-I or vii°-I)
  if (interval.name === "4P" || interval.name === "5P") {
    const [note1, note2] = interval.noteNames;
    const pc1 = Note.get(note1).pc;
    const pc2 = Note.get(note2).pc;

    if (currentKey && currentKey.notes.length > 7) {
      const tonic = currentKey.notes[0];
      const dominant = currentKey.notes[4];

      return (
        (pc1 === dominant && pc2 === tonic) ||
        (pc2 === dominant && pc1 === tonic)
      );
    }
  }

  return false;
}

// Draw an arrow showing resolution direction
export function drawResolutionArrow(
  ctx: CanvasRenderingContext2D,
  note1: VisualNote,
  note2: VisualNote,
  color: CanvasGradient | string,
  opacity: number,
  currentKey: KeySignatureInfo | null
): void {
  // Determine which note is the resolution target (usually tonic)
  let start, end;

  if (currentKey && currentKey.notes.length > 0) {
    const tonic = currentKey.notes[0];
    if (note1.pitchClass === tonic) {
      start = note2;
      end = note1;
    } else {
      start = note1;
      end = note2;
    }
  } else {
    // Default to note2 as target if we can't determine
    start = note1;
    end = note2;
  }

  // Calculate angle for arrow
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);

  // Arrow positioning
  const arrowLength = Math.min(10, Math.sqrt(dx * dx + dy * dy) / 4);
  const arrowWidth = 6;

  // Position arrow near target
  const distRatio = 0.7; // 70% of the way from start to end
  const arrowX = start.x + dx * distRatio;
  const arrowY = start.y + dy * distRatio;

  // Draw arrow
  ctx.save();
  ctx.translate(arrowX, arrowY);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-arrowLength, arrowWidth / 2);
  ctx.lineTo(-arrowLength, -arrowWidth / 2);
  ctx.closePath();

  ctx.fillStyle = typeof color === "string" ? color : "white";
  ctx.globalAlpha = opacity * 0.9;
  ctx.fill();

  ctx.restore();
}

// Get line thickness based on interval consonance
export function getIntervalThickness(interval: IntervalInfo): number {
  // Define consonance levels - thicker for more consonant intervals
  const intervalThicknessMap: Record<string, number> = {
    "1P": 5, // Perfect unison
    "8P": 5, // Perfect octave
    "5P": 4, // Perfect fifth
    "4P": 3, // Perfect fourth
    "3M": 3, // Major third
    "6M": 3, // Major sixth
    "3m": 2.5, // Minor third
    "6m": 2.5, // Minor sixth
    "2M": 2, // Major second
    "7m": 2, // Minor seventh
    "2m": 1, // Minor second
    "7M": 1, // Major seventh
    "4A": 1.5, // Augmented fourth (tritone)
    "5d": 1.5, // Diminished fifth (tritone)
  };

  return intervalThicknessMap[interval.name] || 1;
}
