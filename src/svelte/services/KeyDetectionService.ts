// KeyDetectionService.ts
import { Note, Scale, Key, PcSet } from "@tonaljs/tonal";

// Type for note data
export interface NoteData {
  id: string;
  name: string;
  midiNumber: number;
  timestamp: number;
  inKey: boolean;
  velocity: number;
}

// Interface for detected key info
export interface KeySignatureInfo {
  keyName: string;
  notes: string[];
  confidence: number;
}

export class KeyDetectionService {
  // List of common key signatures we want to detect
  private commonKeys = [
    "C major",
    "G major",
    "D major",
    "A major",
    "E major",
    "B major",
    "F# major",
    "Db major",
    "Ab major",
    "Eb major",
    "Bb major",
    "F major",
    "A minor",
    "E minor",
    "B minor",
    "F# minor",
    "C# minor",
    "G# minor",
    "D# minor",
    "Bb minor",
    "F minor",
    "C minor",
    "G minor",
    "D minor",
  ];

  // Current detected key
  private currentKey: KeySignatureInfo | null = null;

  // Detect the most likely key signature from a set of notes
  public detectKey(notes: NoteData[]): KeySignatureInfo | null {
    // If there are fewer than 3 notes, we don't have enough information
    if (notes.length < 3) {
      console.log("Not enough notes to detect key signature");
      return null;
    }

    // Extract note names from the note data (remove octave information)
    const noteNames = notes.map((n) => Note.get(n.name).pc);
    console.log("Notes for key detection:", noteNames);

    // Use Tonal.js to detect possible scales
    const scaleMatches = Scale.detect(noteNames);
    console.log("Detected scales:", scaleMatches);

    // Filter to include only common key signatures
    const keyMatches = this.getCommonKeyMatches(scaleMatches);
    console.log("Common key matches:", keyMatches);

    if (keyMatches.length === 0) {
      return null;
    }

    // Calculate confidence score for each key
    const keysWithConfidence = keyMatches.map((keyName) => {
      const scale = Scale.get(keyName);
      const scaleNotes = scale.notes;

      // Count how many played notes are in this key
      const matchingNotes = noteNames.filter((note) =>
        scaleNotes.includes(note)
      );

      // Calculate confidence score
      const confidence = matchingNotes.length / noteNames.length;

      return {
        keyName: keyName,
        notes: scaleNotes,
        confidence: confidence,
      };
    });

    // Sort by confidence score
    keysWithConfidence.sort((a, b) => b.confidence - a.confidence);

    // Take the key with highest confidence
    this.currentKey = keysWithConfidence[0];
    return this.currentKey;
  }

  // Check if a note is in the current key signature
  public isNoteInKey(noteName: string): boolean {
    if (!this.currentKey) {
      return true; // If no key detected, consider all notes in key
    }

    // Get pitch class of the note (remove octave)
    const pitchClass = Note.get(noteName).pc;

    // Check if the note is in the key's scale
    return this.currentKey.notes.includes(pitchClass);
  }

  // Process notes to add inKey property
  public processNotes(notes: NoteData[]): NoteData[] {
    // First detect the key
    this.detectKey(notes);

    // If we couldn't detect a key, all notes are considered in key
    if (!this.currentKey) {
      return notes.map((note) => ({
        ...note,
        inKey: true,
      }));
    }

    // Otherwise, mark each note as in key or not
    return notes.map((note) => ({
      ...note,
      inKey: this.isNoteInKey(note.name),
    }));
  }

  // Get the current detected key
  public getCurrentKey(): KeySignatureInfo | null {
    return this.currentKey;
  }

  // Filter scale matches to only include common key signatures
  private getCommonKeyMatches(scaleMatches: string[]): string[] {
    return scaleMatches.filter((scale) => {
      return this.commonKeys.includes(scale);
    });
  }
}
