import { quantumState } from './core/QuantumState.js';
import { AtomEngine } from './core/AtomEngine.js';
import { GestureController } from './core/GestureController.js';
import { HUDOverlay } from './ui/HUDOverlay.js';
import { PeriodicTableModal } from './ui/PeriodicTableModal.js';
import { SynthesisLabModal } from './ui/SynthesisLabModal.js';
import { ElectronInspector } from './ui/ElectronInspector.js';
import { sound } from './audio/soundFX.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log("⚛️ J.A.R.V.I.S. Subatomic Hologram System Initializing...");

  const canvasContainer = document.getElementById('canvas-container');
  const hudContainer = document.getElementById('hud-container');

  // 1. Initialize 3D WebGL Atom Engine
  const atomEngine = new AtomEngine(canvasContainer, quantumState);

  // 2. Initialize Modals & UI Panels
  const periodicModal = new PeriodicTableModal(hudContainer, quantumState);
  const synthModal = new SynthesisLabModal(hudContainer, quantumState);
  const electronInspector = new ElectronInspector(hudContainer, quantumState);

  // 3. Initialize MediaPipe Gesture Tracking
  // (We create placeholder video & canvas inside DOM before HUD mounts)
  let videoEl = document.getElementById('webcam-video');
  let canvasEl = document.getElementById('webcam-canvas');

  // 4. Initialize HUD Overlay
  const hud = new HUDOverlay(
    hudContainer,
    quantumState,
    atomEngine,
    null, // will link gesture after creation
    periodicModal,
    synthModal
  );

  // Retrieve actual PIP elements after HUD render
  videoEl = document.getElementById('webcam-video');
  canvasEl = document.getElementById('webcam-canvas');

  const gestureController = new GestureController(videoEl, canvasEl, atomEngine, quantumState);
  hud.gesture = gestureController;

  // Auto-attempt webcam start (or graceful fallback to mouse mode)
  try {
    gestureController.startCamera().catch(err => {
      console.log("Webcam auto-start deferred until user permission granted:", err);
    });
  } catch (e) {
    console.log("Camera init note:", e);
  }

  // Audio interaction unlock on first click
  const unlockAudio = () => {
    sound.ensureContext();
    sound.playJarvisBeep(true);
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  console.log("⚛️ J.A.R.V.I.S. Core Online. Ready for Subatomic Manipulation.");
});
