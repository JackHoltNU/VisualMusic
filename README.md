# MIDI Visualizer with Music Theory Analysis

A desktop application that visualizes MIDI input with real-time music theory analysis. WIP

## Features

- **MIDI Input Visualization**: Display notes played on a MIDI keyboard or digital piano
- **Virtual Piano**: Built-in piano simulator for testing without physical MIDI devices
- **Key Signature Detection**: Identifies the most likely key signature based on played notes
- **Interval Analysis**: Shows musical intervals between currently played notes
- **Chord Recognition**: Detects chords and displays their Roman numeral notation
- **Music Theory Feedback**: Color-codes notes to show which are in the current key (green) vs. accidentals (red)

## Technology Stack

- **Svelte**: Frontend framework for reactive UI components
- **TypeScript**: Type-safe JavaScript for robust code
- **Electron**: Cross-platform desktop application framework
- **WebMidi API**: Browser-based MIDI device communication
- **Tonal.js**: Music theory analysis library

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup
1. Clone the repository:
   ```bash
   git clone git@github.com:your-username/midi-visualizer.git
   cd midi-visualizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build and start the application:
   ```bash
   npm start
   ```

## Usage

1. **Connect a MIDI Device**:
   - Connect your MIDI keyboard or digital piano to your computer
   - Select it from the dropdown in the app

2. **Or Use the Virtual Piano**:
   - Click "Enable Virtual Piano" to use the on-screen keyboard
   - Use your mouse or computer keyboard (A-L and W-P keys) to play notes

3. **View Music Theory Analysis**:
   - Play notes to see them appear in the visualization area
   - The app will detect the key signature as you play
   - Notes in the current key are shown in green, accidentals in red
   - Current intervals and detected chords are displayed in the analysis panel

4. **Reset Key Detection**:
   - Click the "Reset" button in the Key Analysis section to clear the note collection and start fresh

## Development

### Project Structure

```
midi-visualizer/
├── src/
│   ├── electron/      # Electron main process code
│   │   └── main.ts    # Main Electron process
│   └── svelte/        # Svelte components and UI code
│       ├── App.svelte # Main application component
│       ├── MidiNote.svelte # Note visualization component
│       ├── PianoSimulator.svelte # Virtual piano component
│       ├── MusicAnalysis.svelte # Theory analysis component
│       ├── services/  # Business logic services
│       │   └── MusicTheoryService.ts # Music theory analysis
│       └── main.ts    # Svelte entry point
├── public/            # Static files
│   └── index.html     # Main HTML file
├── dist/              # Compiled output (gitignored)
├── package.json
├── rollup.config.js
└── tsconfig.json
```

### Build Scripts

- `npm run build`: Build the application
- `npm run dev`: Build and watch for changes
- `npm start`: Build and start the Electron app
- `npm run package`: Create standalone executables

## Future Enhancements

- Advanced chord progression analysis
- Note visualization options (piano roll, staff notation)
- Recording and playback functionality
- Export options for analysis data
- Audio synthesis for the virtual piano

## License

[MIT License](LICENSE)

## Acknowledgments

- [Tonal.js](https://github.com/tonaljs/tonal) for music theory analysis
- [WebMidi.js](https://github.com/djipco/webmidi) for MIDI device handling
- [Svelte](https://svelte.dev/) for the reactive UI framework
- [Electron](https://www.electronjs.org/) for desktop app capabilities
