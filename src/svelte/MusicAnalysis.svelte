<script lang="ts">
    import { MusicTheoryService, type IntervalInfo, type ChordInfo, type KeySignatureInfo } from './services/MusicTheoryService';
    
    // Props
    export let musicService: MusicTheoryService;
    export let currentKey: KeySignatureInfo | null = null;
    export let intervals: IntervalInfo[] = [];
    export let chords: ChordInfo[] = [];
    
    // Event dispatcher for reset
    function resetKeyDetection() {
      musicService.resetNoteCollection();
      dispatchEvent(new CustomEvent('keyReset'));
    }
    
    // Interval descriptions
    const intervalDescriptions: Record<string, string> = {
      '1P': 'Perfect Unison',
      '2m': 'Minor Second',
      '2M': 'Major Second',
      '3m': 'Minor Third',
      '3M': 'Major Third',
      '4P': 'Perfect Fourth',
      '4A': 'Augmented Fourth',
      '5d': 'Diminished Fifth',
      '5P': 'Perfect Fifth',
      '6m': 'Minor Sixth',
      '6M': 'Major Sixth',
      '7m': 'Minor Seventh',
      '7M': 'Major Seventh',
      '8P': 'Perfect Octave'
    };
    
    // Get a readable interval name
    function getIntervalName(interval: string): string {
      return intervalDescriptions[interval] || interval;
    }
    
    // Sort intervals by semitones
    $: sortedIntervals = [...intervals].sort((a, b) => a.semitones - b.semitones);
    
    // Filter out duplicate intervals (same interval between different octaves)
    $: uniqueIntervals = sortedIntervals.filter((interval, index, self) => 
      index === self.findIndex(i => i.name === interval.name)
    );
  </script>
  
  <div class="music-analysis">
    <div class="section key-analysis">
      <div class="section-header">
        <h3>Key Analysis</h3>
        <button class="reset-button" on:click={resetKeyDetection}>Reset</button>
      </div>
      
      {#if currentKey}
        <div class="key-info">
          <div class="key-name">{currentKey.keyName}</div>
          <div class="key-notes">Notes: {currentKey.notes.join(', ')}</div>
          <div class="confidence-meter">
            <div class="confidence-label">Confidence:</div>
            <div class="meter-container">
              <div class="meter-fill" style="width: {currentKey.confidence * 100}%"></div>
            </div>
            <div class="confidence-value">{Math.round(currentKey.confidence * 100)}%</div>
          </div>
        </div>
      {:else}
        <div class="no-data">Play at least 3 different notes to detect a key.</div>
      {/if}
    </div>
    
    <div class="section interval-analysis">
      <h3>Interval Analysis</h3>
      
      {#if uniqueIntervals.length > 0}
        <ul class="interval-list">
          {#each uniqueIntervals as interval}
            <li class="interval">
              <span class="interval-name">{getIntervalName(interval.name)}</span>
              <span class="interval-details">({interval.semitones} semitones)</span>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="no-data">Play multiple notes to see intervals.</div>
      {/if}
    </div>
    
    <div class="section chord-analysis">
      <h3>Chord Analysis</h3>
      
      {#if chords.length > 0}
        <ul class="chord-list">
          {#each chords as chord}
            <li class="chord">
              <div class="chord-name">{chord.name}</div>
              {#if chord.romanNumeral}
                <div class="chord-numeral">Roman: {chord.romanNumeral}</div>
              {/if}
              <div class="chord-notes">Notes: {chord.notes.join(', ')}</div>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="no-data">Play at least 3 notes to see chord analysis.</div>
      {/if}
    </div>
  </div>
  
  <style>
    .music-analysis {
      background-color: #2d2d2d;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
    }
    
    .section {
      background-color: #333;
      border-radius: 5px;
      padding: 12px;
    }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      color: #ddd;
    }
    
    .reset-button {
      background-color: #555;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
    }
    
    .reset-button:hover {
      background-color: #666;
    }
    
    .no-data {
      color: #888;
      font-style: italic;
      font-size: 14px;
    }
    
    .key-info {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .key-name {
      font-size: 18px;
      font-weight: bold;
      color: #4CAF50;
    }
    
    .key-notes {
      font-size: 14px;
      color: #bbb;
    }
    
    .confidence-meter {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 5px;
    }
    
    .confidence-label {
      font-size: 12px;
      color: #999;
    }
    
    .meter-container {
      flex: 1;
      height: 8px;
      background-color: #444;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .meter-fill {
      height: 100%;
      background-color: #4CAF50;
      transition: width 0.3s ease;
    }
    
    .confidence-value {
      font-size: 12px;
      color: #999;
      min-width: 35px;
      text-align: right;
    }
    
    .interval-list, .chord-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .interval, .chord {
      background-color: #444;
      border-radius: 4px;
      padding: 8px 10px;
    }
    
    .interval-name, .chord-name {
      font-weight: bold;
      color: #4CAF50;
    }
    
    .interval-details {
      font-size: 13px;
      color: #999;
      margin-left: 5px;
    }
    
    .chord-numeral {
      margin-top: 3px;
      font-size: 14px;
      color: #FFC107;
    }
    
    .chord-notes {
      margin-top: 3px;
      font-size: 13px;
      color: #bbb;
    }
  </style>