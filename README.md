# MIDI Workstation

A comprehensive desktop music workstation application that combines MIDI visualization, sheet music display, and synthesizer emulation. Designed to run on Raspberry Pi 500 and standard desktop platforms.

- **8BitDo Bluetooth Controller Support**: Navigate between streams using your controller
- **Keyboard Navigation**: Quick stream switching with number keys and arrow keys
- **Optimized for Raspberry Pi**: Tested and designed to perform well on Raspberry Pi hardware

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- MIDI keyboard or digital piano (optional)
- 8BitDo controller (optional)
- Raspberry Pi 500 or standard desktop PC

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/midi-workstation.git
cd midi-workstation
```

2. Install dependencies:

```bash
npm install
```

3. Build the application:

```bash
npm run build
```

4. Launch the application:

```bash
npm start
```

### Packaging for Distribution

To create standalone executables for your platform:

```bash
npm run package
```

This will generate installers in the `release` directory.

## Usage Guide

### Connecting MIDI Devices

1. Connect your MIDI keyboard or digital piano to your computer
2. Start the application
3. In the Visualization or Synthesizer stream, select your MIDI device from the dropdown menu

### Using Sheet Music Display

1. Switch to the Sheet Music stream by clicking "Sheet Music" or pressing "2"
2. Click "Select PDF File" to open sheet music from your computer
3. Navigate pages using the previous/next buttons or by pressing the middle pedal
4. Recent files will appear in the "Recent Files" section for quick access

### Using the Synthesizer

1. Switch to the Synthesizer stream by clicking "Synths" or pressing "3"
2. Select a preset from the dropdown menu
3. Play using your MIDI keyboard or computer keyboard (A-L keys)
4. Adjust parameters using the on-screen controls

### Navigation

- Use the navigation buttons at the top to switch between streams
- Keyboard shortcuts:
  - 1: Visualization Stream
  - 2: Sheet Music Stream
  - 3: Synthesizer Stream
  - Left/Right Arrows: Move between streams
- When connected, use the 8BitDo controller for navigation

## Technology Stack

- **Svelte**: Frontend framework for reactive UI components
- **TypeScript**: Type-safe JavaScript for robust code
- **Electron**: Cross-platform desktop application framework
- **WebMidi API**: Browser-based MIDI device communication
- **Tonal.js**: Music theory analysis library
- **Web Audio API**: Audio synthesis and processing
- **PDF.js**: PDF rendering

## Development

### Project Structure

```
midi-workstation/
├── src/
│   ├── electron/       # Electron main process code
│   │   ├── main.ts     # Main Electron process
│   │   └── preload.ts  # Preload script for IPC
│   └── svelte/         # Svelte components and UI code
│       ├── App.svelte  # Main application component
│       ├── MidiNote.svelte
│       ├── MusicAnalysis.svelte
│       ├── PdfStream.svelte
│       ├── PdfViewer.svelte
│       ├── PianoSimulator.svelte
│       ├── SynthModule.svelte
│       ├── services/   # Business logic services
│       │   ├── MusicTheoryService.ts
│       │   └── SynthService.ts
│       └── main.ts     # Svelte entry point
├── public/             # Static files
│   ├── index.html      # Main HTML file
│   └── preload.js      # Compiled preload script
├── dist/               # Compiled output (gitignored)
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
- [PDF.js](https://github.com/mozilla/pdf.js) for PDF rendering
- [Svelte](https://svelte.dev/) for the reactive UI framework
- [Electron](https://www.electronjs.org/) for desktop app capabilities
