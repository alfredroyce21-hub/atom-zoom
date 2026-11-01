import { SHELL_NAMES, MAX_ELECTRONS_PER_SHELL } from '../data/elements.js';

export class ElectronInspector {
  constructor(containerElement, quantumState) {
    this.container = containerElement;
    this.state = quantumState;
    this.modal = null;

    this.render();
    this.state.subscribe((type, payload) => {
      if (type === 'ELECTRON_SELECTED') {
        this.updateContent(payload);
      } else if (type === 'ELECTRON_IONIZED' || type === 'ELEMENT_CHANGED' || type === 'SPIN_FLIPPED') {
        this.updateContent(this.state.selectedElectron);
      }
    });
  }

  render() {
    this.modal = document.createElement('div');
    this.modal.id = 'electron-inspector-card';
    this.modal.className = 'electron-card hidden';
    this.container.appendChild(this.modal);
  }

  updateContent(electron) {
    if (!electron) {
      this.modal.classList.add('hidden');
      return;
    }

    this.modal.classList.remove('hidden');

    const n = electron.n;
    const shellName = electron.shellName;
    const spinIcon = electron.spin > 0 ? '↑ (+½)' : '↓ (-½)';
    const currentShellIdx = electron.shellIndex;
    const canPromote = currentShellIdx < SHELL_NAMES.length - 1;
    const canDemote = currentShellIdx > 0;

    this.modal.innerHTML = `
      <div class="card-header">
        <div class="card-title">
          <span class="pulsing-dot"></span>
          SUBATOMIC ELECTRON CONSOLE
        </div>
        <button id="close-inspector-btn" class="close-btn" title="Close [Esc]">✕</button>
      </div>

      <div class="card-body">
        <div class="electron-visual-badge" style="border-color: ${'#' + electron.color.toString(16).padStart(6, '0')}">
          <div class="spin-symbol">${electron.spin > 0 ? '⤾' : '⤿'}</div>
          <div class="subshell-label">${electron.subshell}</div>
        </div>

        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Principal Quantum (n)</span>
            <span class="stat-val">${n} (Shell ${shellName})</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Subshell Orbital</span>
            <span class="stat-val font-mono">${electron.subshell}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Intrinsic Spin (s)</span>
            <span class="stat-val font-mono ${electron.spin > 0 ? 'text-amber' : 'text-cyan'}">${spinIcon}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Energy State</span>
            <span class="stat-val font-mono text-cyan">${electron.energy_eV} eV</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Orbital Velocity</span>
            <span class="stat-val font-mono">${(electron.speed * 1000).toFixed(1)} km/s</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Ionization State</span>
            <span class="stat-val font-mono text-gold">Bound Bound</span>
          </div>
        </div>

        <div class="actions-section">
          <div class="actions-title">QUANTUM MANIPULATION:</div>
          <div class="buttons-row">
            <button id="ionize-btn" class="hud-btn btn-danger" title="Eject electron into vacuum">
              ⚡ IONIZE / EJECT
            </button>
            <button id="flip-spin-btn" class="hud-btn btn-subtle" title="Invert spin magnetic quantum state">
              🔄 INVERT SPIN
            </button>
          </div>

          <div class="buttons-row mt-2">
            <button id="jump-up-btn" class="hud-btn btn-cyan" ${!canPromote ? 'disabled' : ''} title="Promote electron to higher shell">
              🔺 EXCITE (n → ${n + 1})
            </button>
            <button id="jump-down-btn" class="hud-btn btn-amber" ${!canDemote ? 'disabled' : ''} title="Drop electron to lower shell & emit photon">
              🔻 DE-EXCITE (n → ${n - 1})
            </button>
          </div>
        </div>
      </div>
    `;

    // Hook listeners
    this.modal.querySelector('#close-inspector-btn').onclick = () => {
      this.state.selectElectron(null);
    };

    this.modal.querySelector('#ionize-btn').onclick = () => {
      this.state.ionizeElectron(electron.id);
    };

    this.modal.querySelector('#flip-spin-btn').onclick = () => {
      this.state.flipSpin(electron.id);
    };

    const jumpUpBtn = this.modal.querySelector('#jump-up-btn');
    if (jumpUpBtn && canPromote) {
      jumpUpBtn.onclick = () => {
        this.state.quantumJump(electron.id, currentShellIdx + 1);
      };
    }

    const jumpDownBtn = this.modal.querySelector('#jump-down-btn');
    if (jumpDownBtn && canDemote) {
      jumpDownBtn.onclick = () => {
        this.state.quantumJump(electron.id, currentShellIdx - 1);
      };
    }
  }
}
