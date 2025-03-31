// src/svelte/visualization/BackgroundRenderer.ts
import type { KeySignatureInfo } from "../services/MusicTheoryService";
import { FUNCTION_COLORS } from "./VisualNoteUtils";

// Calculate coordinates for notes on circle of fifths
export function calculateCircleOfFifthsCoordinates(
  centerX: number,
  centerY: number,
  radius: number
): Map<string, { x: number; y: number }> {
  const coordinates = new Map<string, { x: number; y: number }>();

  // The 12 pitch classes in circle of fifths order (starting with C)
  const circleOfFifths = [
    "C",
    "G",
    "D",
    "A",
    "E",
    "B",
    "F#",
    "C#",
    "G#",
    "D#",
    "A#",
    "F",
  ];

  // Calculate coordinates for each pitch class
  circleOfFifths.forEach((pitch, index) => {
    const angle = index * ((2 * Math.PI) / 12) - Math.PI / 2; // Start at top
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    coordinates.set(pitch, { x, y });

    // Add enharmonic equivalents
    if (pitch === "F#") coordinates.set("Gb", { x, y });
    if (pitch === "C#") coordinates.set("Db", { x, y });
    if (pitch === "G#") coordinates.set("Ab", { x, y });
    if (pitch === "D#") coordinates.set("Eb", { x, y });
    if (pitch === "A#") coordinates.set("Bb", { x, y });
  });

  return coordinates;
}

// Get position for a note based on visualization mode
export function getNotePosition(
  pitchClass: string,
  scaleDegree: number | null,
  noteFunction: string,
  visualizationMode: string,
  circleOfFifthsCoordinates: Map<string, { x: number; y: number }>,
  centerX: number,
  centerY: number,
  circleRadius: number
): { x: number; y: number } {
  if (visualizationMode === "circle-of-fifths") {
    // Position on circle of fifths
    const position = circleOfFifthsCoordinates.get(pitchClass);
    if (position) {
      return position;
    }
  } else if (visualizationMode === "tonal-gravity") {
    // Position based on tonal function and gravity
    const distanceFactor = getDistanceFactorFromTonic(
      noteFunction,
      scaleDegree
    );
    const angle = getAngleForFunction(noteFunction, scaleDegree);

    return {
      x: centerX + circleRadius * distanceFactor * Math.cos(angle),
      y: centerY + circleRadius * distanceFactor * Math.sin(angle),
    };
  }

  // Default to random position as fallback
  return {
    x: Math.random() * (centerX * 2) * 0.8 + centerX * 2 * 0.1,
    y: Math.random() * (centerY * 2) * 0.8 + centerY * 2 * 0.1,
  };
}

// Get distance factor from tonic based on function
function getDistanceFactorFromTonic(
  noteFunction: string,
  scaleDegree: number | null
): number {
  switch (noteFunction) {
    case "tonic":
      return 0.1; // Very close to center
    case "dominant":
      return 0.7;
    case "subdominant":
      return 0.5;
    case "mediant":
      return 0.4;
    default:
      // Scale by degree if available
      if (scaleDegree !== null) {
        return 0.3 + (scaleDegree / 7) * 0.7;
      }
      return 0.9; // Far from center
  }
}

// Get angle for note based on function
function getAngleForFunction(
  noteFunction: string,
  scaleDegree: number | null
): number {
  // Map functions to specific angles
  switch (noteFunction) {
    case "tonic":
      return -Math.PI / 2; // Top
    case "dominant":
      return 0; // Right
    case "subdominant":
      return Math.PI; // Left
    case "mediant":
      return Math.PI / 3; // Upper right
    default:
      // For other notes, distribute by scale degree
      if (scaleDegree !== null) {
        return ((scaleDegree - 1) / 7) * 2 * Math.PI;
      }
      return Math.random() * 2 * Math.PI; // Random angle
  }
}

// Draw tonal gravity background
export function drawTonalGravityBackground(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  currentKey: KeySignatureInfo | null,
  keyCenter: string,
  keyMode: string
): void {
  // Draw concentric circles for tonal distances
  const circles = [0.1, 0.3, 0.5, 0.7, 0.9];

  circles.forEach((radiusFactor) => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * radiusFactor, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(100, 100, 100, ${0.1 + radiusFactor * 0.2})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Draw axes for tonal functions
  const functions = [
    { name: "tonic", angle: -Math.PI / 2, color: FUNCTION_COLORS.tonic },
    { name: "dominant", angle: 0, color: FUNCTION_COLORS.dominant },
    { name: "subdominant", angle: Math.PI, color: FUNCTION_COLORS.subdominant },
    { name: "mediant", angle: Math.PI / 3, color: FUNCTION_COLORS.mediant },
  ];

  functions.forEach((func) => {
    const x = centerX + Math.cos(func.angle) * radius;
    const y = centerY + Math.sin(func.angle) * radius;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = func.color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw function label
    ctx.fillStyle = func.color;
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelX = centerX + Math.cos(func.angle) * (radius + 20);
    const labelY = centerY + Math.sin(func.angle) * (radius + 20);
    ctx.fillText(func.name, labelX, labelY);
  });

  // Draw key center
  ctx.beginPath();
  ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(100, 200, 255, 0.3)";
  ctx.fill();
  ctx.strokeStyle = "rgba(100, 200, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw key name
  if (currentKey) {
    ctx.fillStyle = "white";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${keyCenter} ${keyMode}`, centerX, centerY);
  }
}

// Draw circle of fifths background
export function drawCircleOfFifthsBackground(
  ctx: CanvasRenderingContext2D,
  circleOfFifthsCoordinates: Map<string, { x: number; y: number }>,
  centerX: number,
  centerY: number,
  radius: number,
  currentKey: KeySignatureInfo | null,
  keyCenter: string,
  keyMode: string,
  scaleDegrees: Map<string, number>
): void {
  // Draw main circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw pitch class positions
  circleOfFifthsCoordinates.forEach((position, pitchClass) => {
    // Skip enharmonic duplicates
    if (["Db", "Eb", "Gb", "Ab", "Bb"].includes(pitchClass)) return;

    // Check if this note is in the current key
    const isInKey = currentKey && currentKey.notes.includes(pitchClass);
    const scaleDegree = scaleDegrees.get(pitchClass);

    ctx.beginPath();
    ctx.arc(position.x, position.y, 10, 0, 2 * Math.PI);

    if (isInKey) {
      // Highlight notes in the current key
      ctx.fillStyle = "rgba(100, 200, 255, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
    } else {
      ctx.fillStyle = "rgba(50, 50, 50, 0.1)";
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
    }

    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw pitch class label
    ctx.fillStyle = isInKey
      ? "rgba(200, 230, 255, 0.8)"
      : "rgba(150, 150, 150, 0.5)";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pitchClass, position.x, position.y);

    // If this is part of the current key, show scale degree
    if (isInKey && scaleDegree !== undefined) {
      ctx.font = "10px Arial";
      ctx.fillText(`${scaleDegree}`, position.x, position.y + 15);
    }
  });

  // Draw key center indicator
  if (currentKey) {
    const keyPosition = circleOfFifthsCoordinates.get(keyCenter);
    if (keyPosition) {
      ctx.beginPath();
      ctx.arc(keyPosition.x, keyPosition.y, 20, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(100, 200, 255, 0.2)";
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 200, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw key name
      ctx.fillStyle = "white";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${keyCenter} ${keyMode}`,
        keyPosition.x,
        keyPosition.y - 30
      );
    }
  }
}
