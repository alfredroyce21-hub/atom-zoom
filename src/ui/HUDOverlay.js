import { SHELL_NAMES, MAX_ELECTRONS_PER_SHELL } from '../data/elements.js';
import { sound } from '../audio/soundFX.js';

export class HUDOverlay {
  constructor(containerElement, quantumState, atomEngine, gestureController, periodicModal, synthModal) {
    this.container = containerElement;
    this.state = quantumState;
    this.engine = atomEngine;
    this.gesture = gestureController;
    this.ptable = periodicModal;
    this.synth = synthModal;

    this.root = null;
    this.render();
    this.bindEvents();

    this.state.subscribe((type) => {
      this.updateHeader();
      this.updateBottomDock();
    });
  }

  render() {
    this.root = document.createElement('div');
    this.root.id = 'stark-hud-root';
    this.root.className = 'stark-hud-container';

    this.root.innerHTML = `
      <!-- TOP HOLOGRAPHIC HEADER -->
      <header class="hud-header">
        <div class="hud-left">
          <div class="arc-reactor-logo" title="Stark Industries Arc Reactor Core">
            <svg viewBox="0 0 100 100" class="arc-svg">
              <circle cx="50" cy="50" r="45" class="arc-outer-ring" />
              <circle cx="50" cy="50" r="32" class="arc-inner-ring" />
              <polygon points="50,22 74,64 26,64" class="arc-triangle" />
              <circle cx="50" cy="50" r="10" class="arc-center-glow" />
            </svg>
            <div class="brand-text">
              <span class="brand-title">STARK INDUSTRIES</span>
              <span class="brand-sub">J.A.R.V.I.S. QUANTUM ATOM COLLIDER</span>
            </div>
          </div>

          <div class="element-display-card">
            <button id="prev-el-btn" class="nav-arrow-btn" title="Previous Element [←]">◀</button>
            <div class="element-main-info" id="element-quick-info">
              <!-- Dynamically populated -->
            </div>
            <button id="next-el-btn" class="nav-arrow-btn" title="Next Element [→]">▶</button>
          </div>
        </div>

        <div class="hud-center">
          <div class="gesture-status-pill" id="gesture-status-pill">
            <span class="radar-dot"></span>
            <span id="gesture-text">OPTICAL TRACKING: INITIALIZING...</span>
          </div>
        </div>

        <div class="hud-right">
          <button id="ptable-btn" class="hud-btn btn-cyan" title="Open Periodic Table Matrix [P]">
            📊 PERIODIC TABLE (118)
          </button>
          <button id="synth-btn" class="hud-btn btn-amber" title="Tony Stark Element Synthesizer [S]">
            ⚡ SYNTHESIZE NEW ELEMENT
          </button>
          <button id="gesture-guide-btn" class="hud-btn btn-subtle" title="Gesture Instructions [H]">
            ✋ GESTURE GUIDE
          </button>
          <button id="audio-toggle-btn" class="hud-icon-btn" title="Toggle Sound FX [M]">
            🔊
          </button>
          <button id="camera-toggle-btn" class="hud-icon-btn is-active" title="Toggle Optical Tracking / Webcam [C]">
            📹
          </button>
        </div>
      </header>

      <!-- WEBCAM PICTURE-IN-PICTURE HUD (TOP RIGHT) -->
      <div class="webcam-pip-container" id="webcam-pip">
        <div class="pip-header">
          <span class="pip-status-dot"></span>
          <span>OPTICAL SENSOR // LANDMARK TRACKER</span>
          <button id="pip-minimize-btn" class="pip-min-btn">_</button>
        </div>
        <div class="pip-body">
          <video id="webcam-video" autoplay playsinline muted class="hidden-video"></video>
          <canvas id="webcam-canvas" width="240" height="180" class="pip-canvas"></canvas>
          <div class="pip-reticle-overlay">
            <div class="corner-bracket top-left"></div>
            <div class="corner-bracket top-right"></div>
            <div class="corner-bracket bottom-left"></div>
            <div class="corner-bracket bottom-right"></div>
          </div>
        </div>
      </div>

      <!-- BOTTOM CONTROL DOCK -->
      <footer class="hud-footer">
        <div class="dock-shells-panel">
          <div class="dock-panel-title">ELECTRON SHELL DISTRIBUTION (n = 1...7):</div>
          <div class="shells-pills-row" id="shells-pills-row">
            <!-- Dynamically populated shell pills -->
          </div>
        </div>

        <div class="dock-controls-panel">
          <div class="control-unit">
            <label>STARK EXPO DECONSTRUCT (EXPLODE SHELLS):</label>
            <div class="slider-with-val">
              <input type="range" id="deconstruct-slider" min="1.0" max="3.5" step="0.05" value="1.0" class="hud-range">
              <span id="deconstruct-val" class="font-mono text-cyan">1.0x</span>
            </div>
          </div>

          <div class="control-unit">
            <label>ORBIT SPEED:</label>
            <div class="slider-with-val">
              <input type="range" id="speed-slider" min="0" max="2.5" step="0.1" value="1.0" class="hud-range">
              <span id="speed-val" class="font-mono text-cyan">1.0x</span>
            </div>
          </div>

          <div class="dock-buttons-row">
            <button id="add-electron-btn" class="hud-btn btn-cyan" title="Add electron to valence shell">
              ➕ ADD ELECTRON
            </button>
            <button id="freeze-btn" class="hud-btn btn-subtle" title="Freeze orbital time [Space]">
              ⏸️ QUANTUM FREEZE
            </button>
            <button id="reset-cam-btn" class="hud-btn btn-subtle" title="Reset View [R]">
              🎯 RE-CENTER
            </button>
          </div>
        </div>
      </footer>

      <!-- GESTURE GUIDE MODAL -->
      <div id="gesture-guide-modal" class="modal-backdrop hidden">
        <div class="modal-dialog guide-dialog">
          <div class="modal-header">
            <div class="modal-title">
              <span class="pulsing-dot"></span>
              IRON MAN 2 // HOLOGRAPHIC GESTURE COMMAND REFERENCE
            </div>
            <button id="close-guide-btn" class="close-btn">✕</button>
          </div>

          <div class="guide-grid">
            <div class="guide-card">
              <div class="guide-icon">🤏</div>
              <div class="guide-title">PINCH & DRAG</div>
              <div class="guide-desc">Pinch your index finger and thumb together to grab the hologram orb and spin it smoothly in 3D space.</div>
            </div>

            <div class="guide-card">
              <div class="guide-icon">✌️ ✌️</div>
              <div class="guide-title">TWO-HAND ZOOM</div>
              <div class="guide-desc">Bring both hands into view. Move your hands closer or farther apart to zoom smoothly in and out into the nucleus.</div>
            </div>

            <div class="guide-card">
              <div class="guide-icon">👐</div>
              <div class="guide-title">STARK EXPO DECONSTRUCT</div>
              <div class="guide-desc">Pull both hands far apart outwards to expand/explode the orbital shells outward, revealing the inner core.</div>
            </div>

            <div class="guide-card">
              <div class="guide-icon">👆</div>
              <div class="guide-title">INDEX POINT / TARGET</div>
              <div class="guide-desc">Point your index finger like a laser targeting beam to hover over electrons and view quantum readouts in real-time.</div>
            </div>

            <div class="guide-card">
              <div class="guide-icon">✊</div>
              <div class="guide-title">FIST (QUANTUM LOCK)</div>
              <div class="guide-desc">Close your hand into a fist to instantly lock orbital motion and freeze electrons in time for steady inspection.</div>
            </div>

            <div class="guide-card">
              <div class="guide-icon">🖐️ ➡️</div>
              <div class="guide-title">HORIZONTAL SWIPE</div>
              <div class="guide-desc">Swipe your hand swiftly left or right across the camera to switch to the Previous or Next element in the periodic table.</div>
            </div>
          </div>

          <div class="mouse-fallback-note">
            💡 <strong>Mouse & Touch Controls:</strong> Left-click and drag to rotate • Scroll wheel to zoom • Left-click any electron to inspect and edit • Right-click to pan.
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.root);
    this.updateHeader();
    this.updateBottomDock();
  }

  updateHeader() {
    const el = this.state.currentElement;
    const infoContainer = this.root.querySelector('#element-quick-info');
    if (!infoContainer) return;

    const chargeBadge = this.state.ionCharge !== 0 ?
      `<span class="ion-badge ${this.state.ionCharge > 0 ? 'bg-amber' : 'bg-cyan'}">${this.state.ionCharge > 0 ? '+' + this.state.ionCharge : this.state.ionCharge} Ion</span>` :
      `<span class="ion-badge bg-neutral">Neutral</span>`;

    infoContainer.innerHTML = `
      <div class="element-symbol-box" style="border-color: ${el.color}">
        <span class="z-number">${el.atomicNumber}</span>
        <span class="sym-text" style="color: ${el.color}">${el.symbol}</span>
      </div>
      <div class="element-text-meta">
        <div class="name-row">
          <span class="el-name">${el.name}</span>
          ${chargeBadge}
        </div>
        <div class="sub-meta">
          <span>Mass: <strong>${el.atomicMass ? el.atomicMass.toFixed(2) : ''} u</strong></span>
          <span>Config: <strong>${el.electronConfig}</strong></span>
          <span>Electrons: <strong>${this.state.electrons.length}</strong></span>
        </div>
      </div>
    `;
  }

  updateBottomDock() {
    const pillsRow = this.root.querySelector('#shells-pills-row');
    if (!pillsRow) return;
    pillsRow.innerHTML = '';

    SHELL_NAMES.forEach((name, idx) => {
      if (idx >= this.state.shells.length && idx > 3) return;
      const count = this.state.shells[idx] || 0;
      const max = MAX_ELECTRONS_PER_SHELL[idx];
      const color = '#' + this.state.getShellColor(idx).toString(16).padStart(6, '0');

      const pill = document.createElement('div');
      pill.className = `shell-pill ${count > 0 ? 'has-electrons' : 'is-empty'}`;
      pill.style.borderColor = color;
      pill.innerHTML = `
        <span class="shell-name" style="color: ${color}">Shell ${name} (n=${idx + 1})</span>
        <span class="shell-count">${count} / ${max}</span>
      `;

      pill.onclick = () => {
        // Quick add electron to this specific shell
        this.state.addElectron(idx);
      };

      pillsRow.appendChild(pill);
    });
  }

  bindEvents() {
    // Nav elements
    this.root.querySelector('#prev-el-btn').onclick = () => this.state.prevElement();
    this.root.querySelector('#next-el-btn').onclick = () => this.state.nextElement();

    // Modals
    this.root.querySelector('#ptable-btn').onclick = () => this.ptable.toggle();
    this.root.querySelector('#synth-btn').onclick = () => this.synth.toggle();

    // Sound toggle
    const audioBtn = this.root.querySelector('#audio-toggle-btn');
    audioBtn.onclick = () => {
      const isMuted = sound.toggleMute();
      audioBtn.textContent = isMuted ? '🔇' : '🔊';
      audioBtn.classList.toggle('is-muted', isMuted);
    };

    // Camera toggle
    const camBtn = this.root.querySelector('#camera-toggle-btn');
    camBtn.onclick = async () => {
      if (this.gesture.isTracking) {
        this.gesture.stopCamera();
        camBtn.classList.remove('is-active');
        camBtn.textContent = '📷';
      } else {
        const ok = await this.gesture.startCamera();
        if (ok) {
          camBtn.classList.add('is-active');
          camBtn.textContent = '📹';
        }
      }
    };

    // Guide Modal
    const guideModal = this.root.querySelector('#gesture-guide-modal');
    this.root.querySelector('#gesture-guide-btn').onclick = () => guideModal.classList.remove('hidden');
    this.root.querySelector('#close-guide-btn').onclick = () => guideModal.classList.add('hidden');
    guideModal.onclick = (e) => {
      if (e.target === guideModal) guideModal.classList.add('hidden');
    };

    // Deconstruct slider
    const deconstructSlider = this.root.querySelector('#deconstruct-slider');
    const deconstructVal = this.root.querySelector('#deconstruct-val');
    deconstructSlider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      deconstructVal.textContent = `${val.toFixed(1)}x`;
      this.state.setDeconstruct(val);
      sound.playDeconstructWhoosh();
    };

    // Speed slider
    const speedSlider = this.root.querySelector('#speed-slider');
    const speedVal = this.root.querySelector('#speed-val');
    speedSlider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      speedVal.textContent = `${val.toFixed(1)}x`;
      this.state.setSpeed(val);
    };

    // Buttons
    this.root.querySelector('#add-electron-btn').onclick = () => this.state.addElectron();

    const freezeBtn = this.root.querySelector('#freeze-btn');
    freezeBtn.onclick = () => {
      this.state.toggleFreeze();
      freezeBtn.textContent = this.state.isFrozen ? '▶️ RESUME' : '⏸️ QUANTUM FREEZE';
      freezeBtn.classList.toggle('is-frozen', this.state.isFrozen);
    };

    this.root.querySelector('#reset-cam-btn').onclick = () => {
      this.engine.camera.position.set(0, 16, 38);
      this.engine.controls.target.set(0, 0, 0);
      this.engine.atomGroup.rotation.set(0, 0, 0);
      sound.playJarvisBeep();
    };

    // Gesture Status updates
    this.state.subscribe((type, payload) => {
      if (type === 'GESTURE_UPDATED') {
        const statusText = this.root.querySelector('#gesture-text');
        if (statusText && payload.name) {
          statusText.textContent = payload.name;
        }
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') this.state.nextElement();
      if (e.key === 'ArrowLeft') this.state.prevElement();
      if (e.key === ' ') {
        e.preventDefault();
        freezeBtn.click();
      }
      if (e.key.toLowerCase() === 'p') this.ptable.toggle();
      if (e.key.toLowerCase() === 's') this.synth.toggle();
      if (e.key.toLowerCase() === 'h') guideModal.classList.toggle('hidden');
      if (e.key.toLowerCase() === 'm') audioBtn.click();
      if (e.key.toLowerCase() === 'r') this.root.querySelector('#reset-cam-btn').click();
      if (e.key === 'Escape') {
        guideModal.classList.add('hidden');
        this.ptable.close();
        this.synth.close();
        this.state.selectElectron(null);
      }
    });

    // Raycast click on canvas
    this.engine.renderer.domElement.addEventListener('click', (e) => {
      this.engine.selectAtScreen(e.clientX, e.clientY);
    });

    // Hover mouse over electrons
    this.engine.renderer.domElement.addEventListener('mousemove', (e) => {
      this.engine.raycastScreen(e.clientX, e.clientY);
    });
  }
}
