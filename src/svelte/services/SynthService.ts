// SynthService.ts
export interface OscillatorSettings {
  type: OscillatorType;
  detune: number; // cents
  semitone: number; // semitones (+/- 12)
  gain: number; // 0 to 1
}

export interface EnvelopeSettings {
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0 to 1
  release: number; // seconds
}

export interface FilterSettings {
  type: BiquadFilterType;
  frequency: number;
  Q: number;
  gain: number;
  envelopeAmount: number;
  envelopeAttack: number;
  envelopeDecay: number;
  envelopeRelease: number;
}

export interface SynthVoice {
  note: number;
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  filterNode?: BiquadFilterNode;
  releaseTime?: number;
}

export interface SynthPreset {
  name: string;
  oscillators: OscillatorSettings[];
  envelope: EnvelopeSettings;
  filter: FilterSettings;
}

export class SynthService {
  private audioContext: AudioContext;
  private voices: Map<number, SynthVoice> = new Map();
  private masterGain: GainNode;

  // Default settings
  private oscillatorsSettings: OscillatorSettings[] = [
    { type: "sawtooth", detune: 0, semitone: 0, gain: 0.5 },
    { type: "square", detune: 5, semitone: 0, gain: 0.5 },
  ];

  private envelopeSettings: EnvelopeSettings = {
    attack: 0.05,
    decay: 0.2,
    sustain: 0.6,
    release: 0.5,
  };

  private filterSettings: FilterSettings = {
    type: "lowpass",
    frequency: 2000,
    Q: 1,
    gain: 0,
    envelopeAmount: 2000,
    envelopeAttack: 0.1,
    envelopeDecay: 0.3,
    envelopeRelease: 0.5,
  };

  // Presets collection
  private presets: Record<string, SynthPreset> = {};

  constructor() {
    // Create audio context
    this.audioContext = new AudioContext();

    // Create master gain node
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.audioContext.destination);

    // Initialize with some presets
    this.initializePresets();
  }

  /**
   * Start the audio context (must be called after a user gesture)
   */
  public start(): void {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  /**
   * Set master volume
   */
  public setMasterVolume(value: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, value));
  }

  /**
   * Get master volume
   */
  public getMasterVolume(): number {
    return this.masterGain.gain.value;
  }

  /**
   * Load a preset
   */
  public loadPreset(presetName: string): void {
    const preset = this.presets[presetName];
    if (!preset) {
      console.error(`Preset "${presetName}" not found`);
      return;
    }

    this.oscillatorsSettings = [...preset.oscillators];
    this.envelopeSettings = { ...preset.envelope };
    this.filterSettings = { ...preset.filter };
  }

  /**
   * Get list of available presets
   */
  public getPresetList(): string[] {
    return Object.keys(this.presets);
  }

  /**
   * Get preset details
   */
  public getPreset(presetName: string): SynthPreset | null {
    return this.presets[presetName] || null;
  }

  /**
   * Create a custom preset
   */
  public savePreset(name: string, preset: SynthPreset): void {
    this.presets[name] = { ...preset };
  }

  /**
   * Convert MIDI note number to frequency
   */
  private midiToFrequency(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  /**
   * Convert semitones to frequency ratio
   */
  private semitoneToRatio(semitone: number): number {
    return Math.pow(2, semitone / 12);
  }

  // Initialize with classic synth presets
  /**
   * Play a note
   */
  public noteOn(note: number, velocity: number = 0.7): void {
    // If note is already playing, stop it first
    if (this.voices.has(note)) {
      this.noteOff(note);
    }

    // Create voice elements
    const voiceGain = this.audioContext.createGain();
    voiceGain.gain.value = 0;

    // Create filter if enabled
    let filterNode: BiquadFilterNode | undefined;
    if (this.filterSettings) {
      filterNode = this.audioContext.createBiquadFilter();
      filterNode.type = this.filterSettings.type;
      filterNode.frequency.value = this.filterSettings.frequency;
      filterNode.Q.value = this.filterSettings.Q;

      if (filterNode.gain) {
        filterNode.gain.value = this.filterSettings.gain;
      }

      // Connect filter envelope
      const now = this.audioContext.currentTime;
      filterNode.frequency.cancelScheduledValues(now);
      filterNode.frequency.setValueAtTime(this.filterSettings.frequency, now);
      filterNode.frequency.linearRampToValueAtTime(
        this.filterSettings.frequency + this.filterSettings.envelopeAmount,
        now + this.filterSettings.envelopeAttack
      );
      filterNode.frequency.linearRampToValueAtTime(
        this.filterSettings.frequency,
        now +
          this.filterSettings.envelopeAttack +
          this.filterSettings.envelopeDecay
      );

      voiceGain.connect(filterNode);
      filterNode.connect(this.masterGain);
    } else {
      voiceGain.connect(this.masterGain);
    }

    // Create oscillators
    const oscillators: OscillatorNode[] = [];

    for (const settings of this.oscillatorsSettings) {
      const osc = this.audioContext.createOscillator();
      osc.type = settings.type;

      // Apply detune and semitone offset
      const baseFreq = this.midiToFrequency(note);
      const freqWithSemitone =
        baseFreq * this.semitoneToRatio(settings.semitone);
      osc.frequency.value = freqWithSemitone;
      osc.detune.value = settings.detune;

      // Create individual oscillator gain to mix them
      const oscGain = this.audioContext.createGain();
      oscGain.gain.value = settings.gain * velocity;

      osc.connect(oscGain);
      oscGain.connect(voiceGain);
      oscillators.push(osc);

      // Start the oscillator
      osc.start();
    }

    // Apply amplitude envelope
    const now = this.audioContext.currentTime;
    voiceGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(
      velocity,
      now + this.envelopeSettings.attack
    );
    voiceGain.gain.linearRampToValueAtTime(
      velocity * this.envelopeSettings.sustain,
      now + this.envelopeSettings.attack + this.envelopeSettings.decay
    );

    // Store the voice
    this.voices.set(note, {
      note,
      oscillators,
      gainNode: voiceGain,
      filterNode,
    });
  }

  /**
   * Stop a note
   */
  public noteOff(note: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;

    const now = this.audioContext.currentTime;
    const releaseEnd = now + this.envelopeSettings.release;

    // Apply release envelope
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.linearRampToValueAtTime(0, releaseEnd);

    // Apply filter release if applicable
    if (voice.filterNode && this.filterSettings) {
      voice.filterNode.frequency.cancelScheduledValues(now);
      voice.filterNode.frequency.setValueAtTime(
        voice.filterNode.frequency.value,
        now
      );
      voice.filterNode.frequency.linearRampToValueAtTime(
        this.filterSettings.frequency,
        now + this.filterSettings.envelopeRelease
      );
    }

    // Stop oscillators after release
    voice.oscillators.forEach((osc) => {
      osc.stop(releaseEnd);
    });

    // Set release time so we can clean up later
    voice.releaseTime = releaseEnd;

    // Schedule cleanup
    setTimeout(() => {
      this.voices.delete(note);
    }, this.envelopeSettings.release * 1000 + 100);
  }

  /**
   * Stop all notes
   */
  public allNotesOff(): void {
    const notes = Array.from(this.voices.keys());
    notes.forEach((note) => this.noteOff(note));
  }

  /**
   * Update oscillator settings
   */
  public updateOscillator(
    index: number,
    settings: Partial<OscillatorSettings>
  ): void {
    if (index < 0 || index >= this.oscillatorsSettings.length) {
      console.error(`Oscillator index ${index} out of range`);
      return;
    }

    this.oscillatorsSettings[index] = {
      ...this.oscillatorsSettings[index],
      ...settings,
    };

    // Update active voices
    this.voices.forEach((voice) => {
      const osc = voice.oscillators[index];
      if (!osc) return;

      if (settings.type !== undefined) {
        osc.type = settings.type;
      }

      if (settings.detune !== undefined) {
        osc.detune.value = settings.detune;
      }

      if (settings.semitone !== undefined) {
        const baseFreq = this.midiToFrequency(voice.note);
        const freqWithSemitone =
          baseFreq * this.semitoneToRatio(settings.semitone);
        osc.frequency.value = freqWithSemitone;
      }
    });
  }

  /**
   * Update envelope settings
   */
  public updateEnvelope(settings: Partial<EnvelopeSettings>): void {
    this.envelopeSettings = {
      ...this.envelopeSettings,
      ...settings,
    };
  }

  /**
   * Update filter settings
   */
  public updateFilter(settings: Partial<FilterSettings>): void {
    this.filterSettings = {
      ...this.filterSettings,
      ...settings,
    };

    // Update active voice filters
    this.voices.forEach((voice) => {
      if (!voice.filterNode) return;

      if (settings.type !== undefined) {
        voice.filterNode.type = settings.type;
      }

      if (settings.frequency !== undefined) {
        // Don't update immediately, as it might be during an envelope
      }

      if (settings.Q !== undefined) {
        voice.filterNode.Q.value = settings.Q;
      }

      if (settings.gain !== undefined && voice.filterNode.gain) {
        voice.filterNode.gain.value = settings.gain;
      }
    });
  }

  private initializePresets() {
    // Jupiter 8 style brass
    this.presets["jupiter-brass"] = {
      name: "Jupiter Brass",
      oscillators: [
        { type: "sawtooth", detune: 0, semitone: 0, gain: 0.5 },
        { type: "square", detune: 5, semitone: 0, gain: 0.3 },
      ],
      envelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.6,
        release: 0.4,
      },
      filter: {
        type: "lowpass",
        frequency: 1200,
        Q: 2,
        gain: 0,
        envelopeAmount: 3000,
        envelopeAttack: 0.01,
        envelopeDecay: 0.2,
        envelopeRelease: 0.3,
      },
    };

    // Jupiter 8 style strings
    this.presets["jupiter-strings"] = {
      name: "Jupiter Strings",
      oscillators: [
        { type: "sawtooth", detune: 0, semitone: 0, gain: 0.4 },
        { type: "sawtooth", detune: 7, semitone: 0, gain: 0.4 },
        { type: "sawtooth", detune: -7, semitone: 12, gain: 0.2 },
      ],
      envelope: {
        attack: 0.3,
        decay: 0.5,
        sustain: 0.7,
        release: 1.5,
      },
      filter: {
        type: "lowpass",
        frequency: 800,
        Q: 0.5,
        gain: 0,
        envelopeAmount: 500,
        envelopeAttack: 0.5,
        envelopeDecay: 1.0,
        envelopeRelease: 1.0,
      },
    };

    // Jupiter 8 style bass
    this.presets["jupiter-bass"] = {
      name: "Jupiter Bass",
      oscillators: [
        { type: "sawtooth", detune: 0, semitone: 0, gain: 0.6 },
        { type: "square", detune: 0, semitone: -12, gain: 0.4 },
      ],
      envelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.4,
        release: 0.2,
      },
      filter: {
        type: "lowpass",
        frequency: 500,
        Q: 4,
        gain: 0,
        envelopeAmount: 4000,
        envelopeAttack: 0.01,
        envelopeDecay: 0.1,
        envelopeRelease: 0.1,
      },
    };
  }
}
