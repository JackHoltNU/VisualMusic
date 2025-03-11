// MusicTheoryService.ts
import {
  Note,
  Interval,
  Chord,
  Scale,
  Key,
  PcSet,
  ChordType,
} from "@tonaljs/tonal";

// Types
export interface NoteData {
  id: string;
  name: string;
  midiNumber: number;
  timestamp: number;
  inKey: boolean;
  velocity: number;
  active: boolean; // Whether the note is currently being played
}

export interface KeySignatureInfo {
  keyName: string;
  notes: string[];
  confidence: number;
}

export interface IntervalInfo {
  name: string;
  semitones: number;
  noteNames: [string, string]; // The two notes forming this interval
}

export interface ChordInfo {
  name: string;
  type: string;
  quality: string;
  notes: string[];
  romanNumeral: string | null; // Roman numeral in the context of current key
}

export class MusicTheoryService {
  // List of common key signatures to detect
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

  // All notes that have been played (persistent collection)
  private allPlayedNotes: Set<string> = new Set();

  // All active notes (currently being held)
  private activeNotes: NoteData[] = [];

  // Reset note collection for key detection
  public resetNoteCollection(): void {
    this.allPlayedNotes.clear();
    this.currentKey = null;
  }

  // Add a note to the persistent collection
  public addNoteToCollection(noteName: string): void {
    // Extract just the pitch class (remove octave)
    const pitchClass = Note.get(noteName).pc;
    this.allPlayedNotes.add(pitchClass);
  }

  // Set active notes (currently being played or recently played)
  public setActiveNotes(notes: NoteData[]): void {
    this.activeNotes = [...notes];

    // Add all notes to the persistent collection
    notes.forEach((note) => {
      this.addNoteToCollection(note.name);
    });
  }

  // Detect the most likely key signature from all played notes
  public detectKey(): KeySignatureInfo | null {
    // Convert the Set to an array
    const allNotes = Array.from(this.allPlayedNotes);

    // If there are fewer than 3 unique notes, we don't have enough information
    if (allNotes.length < 3) {
      console.log("Not enough notes to detect key signature");
      return null;
    }

    console.log("All notes for key detection:", allNotes);

    // Use Tonal.js to detect possible scales
    const scaleMatches = Scale.detect(allNotes);
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
      const matchingNotes = allNotes.filter((note) =>
        scaleNotes.includes(note)
      );

      // Calculate confidence score
      const confidence = matchingNotes.length / allNotes.length;

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

  // Detect intervals between active notes
  public detectIntervals(): IntervalInfo[] {
    const intervals: IntervalInfo[] = [];
    const activeNoteNames = this.activeNotes.map((n) => n.name);

    // Need at least 2 notes to form an interval
    if (activeNoteNames.length < 2) {
      return intervals;
    }

    // Compare each pair of notes
    for (let i = 0; i < activeNoteNames.length; i++) {
      for (let j = i + 1; j < activeNoteNames.length; j++) {
        const note1 = activeNoteNames[i];
        const note2 = activeNoteNames[j];

        // Calculate interval
        const intervalName = Interval.distance(note1, note2);
        const semitones = Interval.semitones(intervalName) || 0;

        intervals.push({
          name: intervalName,
          semitones: semitones,
          noteNames: [note1, note2],
        });
      }
    }

    return intervals;
  }

  // Detect chords from active notes
  public detectChords(): ChordInfo[] {
    // Get pitch classes of active notes (remove octave)
    const pitchClasses = this.activeNotes.map((n) => Note.get(n.name).pc);
    const uniquePitchClasses = [...new Set(pitchClasses)];

    // Need at least 3 unique notes to form a chord
    if (uniquePitchClasses.length < 3) {
      return [];
    }

    // Detect chords
    const possibleChords = Chord.detect(uniquePitchClasses);
    console.log("Detected chords:", possibleChords);

    if (possibleChords.length === 0) {
      return [];
    }

    // Map to ChordInfo objects
    const chords = possibleChords.map((chordName) => {
      const chord = Chord.get(chordName);
      const rootNote = chord.tonic || "";

      return {
        name: chordName,
        type: chord.type,
        quality: this.getChordQuality(chord.type),
        notes: chord.notes,
        romanNumeral: this.getRomanNumeral(rootNote, chord.type),
      };
    });

    return chords;
  }

  // Get chord quality from type
  private getChordQuality(chordType: string): string {
    if (chordType.includes("maj") || chordType === "M" || chordType === "") {
      return "major";
    } else if (chordType.includes("min") || chordType === "m") {
      return "minor";
    } else if (chordType.includes("dim")) {
      return "diminished";
    } else if (chordType.includes("aug")) {
      return "augmented";
    } else if (chordType.includes("sus")) {
      return "suspended";
    } else {
      return chordType;
    }
  }

  // Get Roman numeral for a chord in current key
  private getRomanNumeral(rootNote: string, chordType: string): string | null {
    if (!this.currentKey || !rootNote) {
      return null;
    }

    try {
      // Get the key and scale
      const keyObj = Key.majorKey(this.currentKey.keyName.split(" ")[0]);

      // Find the degree of the root note in the scale
      const scaleNotes = keyObj.scale;
      const degree = scaleNotes.findIndex((note) => note === rootNote);

      if (degree === -1) {
        return null; // Root not in scale
      }

      // Roman numerals
      const numerals = ["I", "II", "III", "IV", "V", "VI", "VII"];
      let romanNumeral = numerals[degree];

      // Adjust based on chord quality
      const quality = this.getChordQuality(chordType);
      if (quality === "minor") {
        romanNumeral = romanNumeral.toLowerCase();
      } else if (quality === "diminished") {
        romanNumeral = romanNumeral.toLowerCase() + "°";
      } else if (quality === "augmented") {
        romanNumeral = romanNumeral + "+";
      }

      return romanNumeral;
    } catch (error) {
      console.error("Error getting Roman numeral:", error);
      return null;
    }
  }

  // Filter scale matches to only include common key signatures
  private getCommonKeyMatches(scaleMatches: string[]): string[] {
    return scaleMatches.filter((scale) => {
      return this.commonKeys.includes(scale);
    });
  }
}
