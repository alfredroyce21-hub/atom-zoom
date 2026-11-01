import { ELEMENTS, SHELL_NAMES, MAX_ELECTRONS_PER_SHELL } from '../data/elements.js';
import { sound } from '../audio/soundFX.js';

export class QuantumState {
  constructor() {
    this.elementIndex = 5; // Default to Carbon (Z=6) for beautiful orbital view
    this.currentElement = ELEMENTS[this.elementIndex];
    this.shells = [...this.currentElement.shells];
    this.electrons = [];
    this.selectedElectron = null;
    this.hoveredElectron = null;

    // Simulation controls
    this.deconstructFactor = 1.0; // 1.0 = normal, 3.0 = exploded shells
    this.isFrozen = false;
    this.speedMultiplier = 1.0;
    this.showOrbits = true;
    this.showQuarks = true;
    this.showElectronTrails = true;

    // Gesture tracking state
    this.gestureState = {
      active: false,
      name: "IDLE",
      confidence: 0,
      handCount: 0,
      zoomDelta: 0,
      rotationDelta: { x: 0, y: 0 },
      cursor: { x: 0, y: 0, isHovering: false }
    };

    // Subatomic stats
    this.ionCharge = 0;
    this.netEnergy_eV = 0;
    this.listeners = new Set();

    this.rebuildElectrons();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(changeType, payload) {
    for (const listener of this.listeners) {
      listener(changeType, payload, this);
    }
  }

  setElementByIndex(index) {
    if (index < 0) index = ELEMENTS.length - 1;
    if (index >= ELEMENTS.length) index = 0;
    this.elementIndex = index;
    this.currentElement = ELEMENTS[this.elementIndex];
    this.shells = [...this.currentElement.shells];
    this.selectedElectron = null;
    this.hoveredElectron = null;
    this.rebuildElectrons();
    sound.playJarvisBeep(true);
    this.notify('ELEMENT_CHANGED', this.currentElement);
  }

  nextElement() {
    this.setElementByIndex(this.elementIndex + 1);
  }

  prevElement() {
    this.setElementByIndex(this.elementIndex - 1);
  }

  setDeconstruct(factor) {
    const prev = this.deconstructFactor;
    this.deconstructFactor = Math.max(1.0, Math.min(3.5, factor));
    if (Math.abs(prev - this.deconstructFactor) > 0.05) {
      this.notify('DECONSTRUCT_CHANGED', this.deconstructFactor);
    }
  }

  toggleFreeze() {
    this.isFrozen = !this.isFrozen;
    sound.playJarvisBeep();
    this.notify('FREEZE_TOGGLED', this.isFrozen);
  }

  setSpeed(multiplier) {
    this.speedMultiplier = Math.max(0, Math.min(3.0, multiplier));
    this.notify('SPEED_CHANGED', this.speedMultiplier);
  }

  /**
   * Reconstruct all electrons according to shells array
   */
  rebuildElectrons() {
    this.electrons = [];
    let electronGlobalId = 1;

    // Base radii configuration for shells K -> R
    const baseRadii = [3.2, 5.2, 7.4, 9.8, 12.4, 15.2, 18.2, 21.4];

    this.shells.forEach((count, shellIdx) => {
      const shellName = SHELL_NAMES[shellIdx] || `S${shellIdx + 1}`;
      const radius = baseRadii[shellIdx] || (3.2 + shellIdx * 2.4);

      for (let i = 0; i < count; i++) {
        const phi = (i / count) * Math.PI * 2;
        // Natural 3D orbital tilt based on quantum magnetic quantum numbers
        const inclination = (Math.PI / 4) * Math.sin((i / count) * Math.PI * 2 + shellIdx);
        const spin = (i % 2 === 0) ? 0.5 : -0.5;

        // Subshell assignment: s, p, d, f
        let subshell = "s";
        if (i >= 2 && i < 8) subshell = "p";
        else if (i >= 8 && i < 18) subshell = "d";
        else if (i >= 18) subshell = "f";

        const n = shellIdx + 1;
        // Approximate Rydberg energy: -13.6 * Z^2 / n^2 eV (effective Z approximation)
        const zEff = Math.max(1, this.currentElement.atomicNumber - (shellIdx * 2));
        const energy_eV = -13.6 * ((zEff * zEff) / (n * n));

        // Speed is faster for inner shells (Bohr model: v proportional to 1/n)
        const baseSpeed = (1.8 / (shellIdx + 1)) * 0.025;

        this.electrons.push({
          id: `e-${shellIdx}-${i + 1}-${electronGlobalId++}`,
          shellIndex: shellIdx,
          shellName: shellName,
          subshell: `${n}${subshell}`,
          n: n,
          spin: spin,
          baseRadius: radius,
          currentRadius: radius,
          angle: phi,
          inclination: inclination,
          speed: baseSpeed,
          energy_eV: parseFloat(energy_eV.toFixed(2)),
          isExcited: false,
          color: this.getShellColor(shellIdx)
        });
      }
    });

    this.calculateSubatomicStats();
    this.notify('ELECTRONS_REBUILT', this.electrons);
  }

  getShellColor(shellIdx) {
    const colors = [
      0x00f0ff, // K: Electric Cyan
      0x38bdf8, // L: Sky Blue
      0x60a5fa, // M: Cobalt Glow
      0xa855f7, // N: Purple Neon
      0xec4899, // O: Magenta
      0xf59e0b, // P: Amber Gold
      0x10b981, // Q: Emerald
      0x3b82f6  // R: Deep Blue
    ];
    return colors[shellIdx % colors.length];
  }

  calculateSubatomicStats() {
    const totalElectrons = this.electrons.length;
    this.ionCharge = this.currentElement.atomicNumber - totalElectrons;
    this.netEnergy_eV = this.electrons.reduce((acc, el) => acc + el.energy_eV, 0);
  }

  selectElectron(electron) {
    this.selectedElectron = electron;
    sound.playJarvisBeep(true);
    this.notify('ELECTRON_SELECTED', this.selectedElectron);
  }

  setHoveredElectron(electron) {
    if (this.hoveredElectron?.id !== electron?.id) {
      this.hoveredElectron = electron;
      if (electron) sound.playGestureTick();
      this.notify('ELECTRON_HOVERED', this.hoveredElectron);
    }
  }

  /**
   * IONIZE: Eject / remove the selected electron
   */
  ionizeElectron(electronId) {
    const target = this.electrons.find(e => e.id === electronId);
    if (!target) return;

    sound.playIonizeSound();

    // Decrement from shells count
    const shellIdx = target.shellIndex;
    if (this.shells[shellIdx] > 0) {
      this.shells[shellIdx]--;
    }

    // Remove from active list
    this.electrons = this.electrons.filter(e => e.id !== electronId);
    if (this.selectedElectron?.id === electronId) {
      this.selectedElectron = null;
    }

    this.calculateSubatomicStats();
    this.notify('ELECTRON_IONIZED', { target, newCharge: this.ionCharge });
  }

  /**
   * ADD ELECTRON: Add an electron to a designated shell
   */
  addElectron(shellIdx = null) {
    if (shellIdx === null) {
      // Find outermost non-full shell, or add to valence
      shellIdx = this.shells.findIndex((count, idx) => count < MAX_ELECTRONS_PER_SHELL[idx]);
      if (shellIdx === -1) shellIdx = Math.min(this.shells.length, 6);
    }

    while (this.shells.length <= shellIdx) {
      this.shells.push(0);
    }

    this.shells[shellIdx]++;
    sound.playJarvisBeep(true);
    this.rebuildElectrons();
    this.notify('ELECTRON_ADDED', { shellIndex: shellIdx });
  }

  /**
   * QUANTUM JUMP: Promote/demote electron to different shell
   */
  quantumJump(electronId, targetShellIdx) {
    const target = this.electrons.find(e => e.id === electronId);
    if (!target) return;
    if (targetShellIdx < 0 || targetShellIdx >= MAX_ELECTRONS_PER_SHELL.length) return;

    const currentShellIdx = target.shellIndex;
    if (currentShellIdx === targetShellIdx) return;

    const direction = targetShellIdx > currentShellIdx ? 'up' : 'down';
    sound.playQuantumJumpSound(direction);

    // Update shell tallies
    if (this.shells[currentShellIdx] > 0) this.shells[currentShellIdx]--;
    while (this.shells.length <= targetShellIdx) this.shells.push(0);
    this.shells[targetShellIdx]++;

    this.rebuildElectrons();
    const newSelected = this.electrons.find(e => e.shellIndex === targetShellIdx);
    if (newSelected) this.selectedElectron = newSelected;

    this.notify('QUANTUM_JUMP', {
      fromShell: currentShellIdx,
      toShell: targetShellIdx,
      direction: direction,
      wavelength_nm: Math.abs(1240 / (target.energy_eV || 1))
    });
  }

  /**
   * INVERT SPIN (+1/2 <-> -1/2)
   */
  flipSpin(electronId) {
    const target = this.electrons.find(e => e.id === electronId);
    if (!target) return;

    target.spin = target.spin === 0.5 ? -0.5 : 0.5;
    sound.playJarvisBeep();
    this.notify('SPIN_FLIPPED', target);
  }

  /**
   * TONY STARK SYNTHESIZE NEW CUSTOM ELEMENT
   */
  synthesizeCustomElement(name, symbol, protons, neutrons, customShells) {
    sound.playBeamCharge();

    const newElement = {
      atomicNumber: protons,
      symbol: symbol,
      name: name,
      atomicMass: protons + neutrons,
      category: "superheavy",
      group: 1,
      period: customShells.length,
      shells: customShells,
      electronConfig: `[Og] custom synthesis`,
      description: `Synthesized particle collision: ${protons} Protons, ${neutrons} Neutrons. Tony Stark Arc Reactor Tri-Core replacement!`,
      color: "#00ffff",
      isSynthesized: true
    };

    ELEMENTS.push(newElement);
    this.setElementByIndex(ELEMENTS.length - 1);
    this.notify('NEW_ELEMENT_SYNTHESIZED', newElement);
  }

  updateGestureState(newState) {
    this.gestureState = { ...this.gestureState, ...newState };
    this.notify('GESTURE_UPDATED', this.gestureState);
  }
}

export const quantumState = new QuantumState();
