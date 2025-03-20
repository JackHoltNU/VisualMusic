// src/svelte/services/ControllerService.ts
export interface KeyboardMapping {
    dpadUp: string[];
    dpadDown: string[];
    dpadLeft: string[];
    dpadRight: string[];
    buttonA: string[];
    buttonB: string[];
    buttonX: string[];
    buttonY: string[];
    buttonL1: string[];
    buttonR1: string[];
    buttonL2: string[];
    buttonR2: string[];
    buttonSelect: string[];
    buttonStart: string[];
    buttonPlus: string[];
    buttonMinus: string[];
  }
  
  // Mapping for keyboard keys (both 8BitDo keyboard mode and standard keyboard)
  export const controllerMapping: KeyboardMapping = {
    dpadUp: ['c', 'ArrowUp'],
    dpadDown: ['d', 'ArrowDown'],
    dpadLeft: ['e', 'ArrowLeft'],
    dpadRight: ['f', 'ArrowRight'],
    buttonA: ['g', 'Escape'],
    buttonB: ['j', 'Enter'],
    buttonX: ['h', 'Backspace'],
    buttonY: ['i', ' '], // space
    buttonL1: ['k', 'q'],
    buttonR1: ['m', 'w'],
    buttonL2: ['l'],
    buttonR2: ['r'],
    buttonSelect: ['Tab'],
    buttonStart: ['z'],
    buttonMinus: ['n', '-'],
    buttonPlus: ['o', '+']
  };
  
  export type GamepadEventType = 
    | 'dpad_up' 
    | 'dpad_down' 
    | 'dpad_left' 
    | 'dpad_right'
    | 'button_a'
    | 'button_b'
    | 'button_x'
    | 'button_y'
    | 'button_l1'
    | 'button_r1'
    | 'button_l2'
    | 'button_r2'
    | 'button_select'
    | 'button_start'
    | 'button_plus'
    | 'button_minus';
  
  export type GamepadCallback = (event: GamepadEventType) => void;
  
  export class ControllerService {
    private isRunning: boolean = false;
    private mapping: KeyboardMapping;
    private listeners: Map<GamepadEventType, GamepadCallback[]> = new Map();
    private keyToEventMap: Map<string, GamepadEventType> = new Map();
    private activeKeys: Set<string> = new Set();
    private _isConnected: boolean = true; // Default to true for keyboard-based controller
    
    constructor(mapping: KeyboardMapping = controllerMapping) {
      this.mapping = mapping;
      
      // Initialize listeners map
      const eventTypes: GamepadEventType[] = [
        'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right',
        'button_a', 'button_b', 'button_x', 'button_y',
        'button_l1', 'button_r1', 'button_l2', 'button_r2',
        'button_select', 'button_start', 'button_plus', 'button_minus'
      ];
      
      eventTypes.forEach(type => {
        this.listeners.set(type, []);
      });
      
      // Create reverse mapping from keys to events
      this.createKeyToEventMap();
      
      // Start keyboard listener
      this.startKeyboardListener();
    }
    
    /**
     * Create a mapping from keyboard keys to controller events
     */
    private createKeyToEventMap(): void {
      // Helper function to convert mapping property name to event type
      const mapToEventType = (propName: string): GamepadEventType => {
        return propName.replace(/([A-Z])/g, '_$1').toLowerCase() as GamepadEventType;
      };
      
      // Map each key in the mapping to its corresponding event
      Object.entries(this.mapping).forEach(([prop, keys]) => {
        const eventType = mapToEventType(prop);
        keys.forEach((key: string) => {
          this.keyToEventMap.set(key, eventType);
        });
      });
    }
    
    /**
     * Start listening for keyboard events
     */
    private startKeyboardListener(): void {
      if (this.isRunning) return;
      
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
      window.addEventListener('keyup', this.handleKeyUp.bind(this));
      
      this.isRunning = true;
      console.log('Keyboard controller service started');
    }
    
    /**
     * Stop listening for keyboard events
     */
    private stopKeyboardListener(): void {
      if (!this.isRunning) return;
      
      window.removeEventListener('keydown', this.handleKeyDown.bind(this));
      window.removeEventListener('keyup', this.handleKeyUp.bind(this));
      
      this.isRunning = false;
      console.log('Keyboard controller service stopped');
    }
    
    /**
     * Handle keydown events
     */
    private handleKeyDown(event: KeyboardEvent): void {
      // Skip if we're in an input field
      if (
        event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement || 
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      
      const key = event.key;
      
      // Check if this key is mapped to a controller event
      if (this.keyToEventMap.has(key) && !this.activeKeys.has(key)) {
        const eventType = this.keyToEventMap.get(key)!;
        
        // Mark key as active to prevent repeat events
        this.activeKeys.add(key);
        
        // Trigger the event
        this.triggerEvent(eventType);
        
        // For navigation keys, prevent default browser behavior
        if (
          key === 'ArrowUp' || 
          key === 'ArrowDown' || 
          key === 'ArrowLeft' || 
          key === 'ArrowRight' || 
          key === ' ' || 
          key === 'Tab'
        ) {
          event.preventDefault();
        }
      }
    }
    
    /**
     * Handle keyup events
     */
    private handleKeyUp(event: KeyboardEvent): void {
      const key = event.key;
      
      // Remove key from active keys
      if (this.activeKeys.has(key)) {
        this.activeKeys.delete(key);
      }
    }
    
    /**
     * Trigger an event
     */
    private triggerEvent(eventType: GamepadEventType): void {
      console.log('Controller event:', eventType);
      const callbacks = this.listeners.get(eventType) || [];
      callbacks.forEach(callback => callback(eventType));
    }
    
    /**
     * Add an event listener
     */
    public addEventListener(eventType: GamepadEventType, callback: GamepadCallback): void {
      const callbacks = this.listeners.get(eventType) || [];
      callbacks.push(callback);
      this.listeners.set(eventType, callbacks);
    }
    
    /**
     * Remove an event listener
     */
    public removeEventListener(eventType: GamepadEventType, callback: GamepadCallback): void {
      const callbacks = this.listeners.get(eventType) || [];
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
        this.listeners.set(eventType, callbacks);
      }
    }
    
    /**
     * Check if controller is connected (always true for keyboard controller)
     */
    public get isConnected(): boolean {
      return this._isConnected;
    }
    
    /**
     * Set connected state manually (for UI feedback)
     */
    public setConnected(connected: boolean): void {
      this._isConnected = connected;
    }
    
    /**
     * Clean up resources
     */
    public destroy(): void {
      this.stopKeyboardListener();
    }
  }
  
  // Create a singleton instance
  let instance: ControllerService | null = null;
  
  export function getControllerService(): ControllerService {
    if (!instance) {
      instance = new ControllerService();
    }
    return instance;
  }