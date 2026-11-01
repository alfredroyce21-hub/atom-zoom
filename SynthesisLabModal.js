import { sound } from '../audio/soundFX.js';

export class SynthesisLabModal {
  constructor(containerElement, quantumState) {
    this.container = containerElement;
    this.state = quantumState;
    this.modal = null;
    this.isOpen = false;

    this.render();
  }

  render() {
    this.modal = document.createElement('div');
    this.modal.id = 'synthesis-lab-modal';
    this.modal.className = 'modal-backdrop hidden';
    this.container.appendChild(this.modal);

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  open() {
    this.isOpen = true;
    this.modal.classList.remove('hidden');
    sound.playJarvisBeep(true);
    this.updateContent();
  }

  close() {
    this.isOpen = false;
    this.modal.classList.add('hidden');
    sound.playJarvisBeep(false);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  updateContent() {
    this.modal.innerHTML = `
      <div class="modal-dialog synthesis-dialog">
        <div class="modal-header">
          <div class="modal-title">
            <span class="pulsing-dot pulse-amber"></span>
            STARK PARTICLE ACCELERATOR // SUB-ATOMIC SYNTHESIZER
          </div>
          <button id="close-synth-btn" class="close-btn">✕</button>
        </div>

        <div class="synth-body">
          <div class="mcu-quote">
            "The proposed element serves as a higher-density, non-lethal power matrix replacing palladium in the chest Arc Reactor."
            <div class="quote-author">— J.A.R.V.I.S. Sub-routine Protocol</div>
          </div>

          <div class="synth-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Element Discovery Name:</label>
                <input type="text" id="synth-name" value="Starkium" placeholder="e.g. Vibranium, Badassium, NewElement...">
              </div>
              <div class="form-group w-32">
                <label>Atomic Symbol:</label>
                <input type="text" id="synth-sym" value="St" maxlength="3" placeholder="St">
              </div>
            </div>

            <div class="sliders-panel">
              <div class="slider-group">
                <div class="slider-header">
                  <span>Protons (Z / Core Charge):</span>
                  <span id="proton-val" class="text-cyan font-mono text-lg">119</span>
                </div>
                <input type="range" id="proton-slider" min="1" max="140" value="119" class="hud-range">
              </div>

              <div class="slider-group mt-3">
                <div class="slider-header">
                  <span>Neutrons (Strong Nuclear Mass):</span>
                  <span id="neutron-val" class="text-amber font-mono text-lg">182</span>
                </div>
                <input type="range" id="neutron-slider" min="0" max="220" value="182" class="hud-range">
              </div>
            </div>

            <div class="core-preview-box">
              <div class="core-preview-title">PROJECTED NUCLEUS STABILITY:</div>
              <div class="stability-meter">
                <div id="stability-bar" class="stability-fill" style="width: 94%;"></div>
              </div>
              <div class="core-readout">
                <span>Atomic Mass: <strong id="synth-mass">301</strong> u</span>
                <span>Valence Shell: <strong id="synth-valence">Q-Shell</strong></span>
                <span>Radiation: <strong class="text-cyan">Penta-Harmonic Shielded</strong></span>
              </div>
            </div>

            <div class="action-footer">
              <button id="fire-laser-btn" class="fire-laser-btn">
                ⚡ FIRE PRISM LASER COLLIDER (SYNTHESIZE)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook listeners
    this.modal.querySelector('#close-synth-btn').onclick = () => this.close();

    const pSlider = this.modal.querySelector('#proton-slider');
    const nSlider = this.modal.querySelector('#neutron-slider');
    const pVal = this.modal.querySelector('#proton-val');
    const nVal = this.modal.querySelector('#neutron-val');
    const massVal = this.modal.querySelector('#synth-mass');
    const stabBar = this.modal.querySelector('#stability-bar');

    const updateReadouts = () => {
      const p = parseInt(pSlider.value);
      const n = parseInt(nSlider.value);
      pVal.textContent = p;
      nVal.textContent = n;
      massVal.textContent = p + n;

      // Realistic N/Z stability ratio curve (~1.0 for light, ~1.5 for heavy)
      const ratio = n / (p || 1);
      const idealRatio = 1.0 + (p / 200) * 0.6;
      const deviation = Math.abs(ratio - idealRatio);
      const stability = Math.max(10, Math.min(100, Math.round(100 - deviation * 120)));
      stabBar.style.width = `${stability}%`;
      stabBar.className = `stability-fill ${stability > 70 ? 'bg-cyan' : stability > 40 ? 'bg-amber' : 'bg-red'}`;
    };

    pSlider.oninput = updateReadouts;
    nSlider.oninput = updateReadouts;

    const fireBtn = this.modal.querySelector('#fire-laser-btn');
    fireBtn.onclick = () => {
      const name = this.modal.querySelector('#synth-name').value.trim() || 'Starkium';
      const sym = this.modal.querySelector('#synth-sym').value.trim() || 'St';
      const p = parseInt(pSlider.value);
      const n = parseInt(nSlider.value);

      // Compute shell breakdown automatically for Z
      const shells = this.computeShellsForZ(p);

      fireBtn.disabled = true;
      fireBtn.innerHTML = '⚡ COLLIDING PARTICLES... BEAM ACTIVE ⚡';

      sound.playBeamCharge();

      setTimeout(() => {
        this.state.synthesizeCustomElement(name, sym, p, n, shells);
        this.close();
      }, 1200);
    };
  }

  computeShellsForZ(Z) {
    const maxCapacity = [2, 8, 18, 32, 32, 18, 8, 2];
    const shells = [];
    let remaining = Z;

    for (let i = 0; i < maxCapacity.length && remaining > 0; i++) {
      const count = Math.min(remaining, maxCapacity[i]);
      shells.push(count);
      remaining -= count;
    }
    return shells;
  }
}
