// src/svelte/webmidi.d.ts
declare module "webmidi" {
  export class WebMidi {
    static enable(): Promise<void>;
    static disable(): void;
    static getInputById(id: string): Input | undefined;
    static inputs: Input[];
    static outputs: Output[];
  }

  export interface Input {
    id: string;
    name: string;
    manufacturer: string;
    addListener(
      type: "noteon" | "noteoff",
      callback: (e: NoteEvent) => void
    ): void;
    addListener(
      type: "controlchange",
      callback: (e: ControlChangeEvent) => void
    ): void;
    removeListener(type?: string, callback?: Function): void;
  }

  export interface Output {
    id: string;
    name: string;
    manufacturer: string;
  }

  export interface NoteEvent {
    note: {
      number: number;
      name: string;
      octave: number;
    };
    velocity: number;
    rawVelocity: number;
  }

  export interface ControlChangeEvent {
    controller: {
      number: number;
      name?: string;
    };
    value: number;
    rawValue: number;
    channel: number;
    type: string;
    target: Input;
    timestamp: number;
  }
}
