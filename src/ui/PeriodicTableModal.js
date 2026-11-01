import { ELEMENTS, CATEGORY_LABELS } from '../data/elements.js';
import { sound } from '../audio/soundFX.js';

export class PeriodicTableModal {
  constructor(containerElement, quantumState) {
    this.container = containerElement;
    this.state = quantumState;
    this.modal = null;
    this.isOpen = false;
    this.activeFilter = 'all';
    this.searchQuery = '';

    this.render();
  }

  render() {
    this.modal = document.createElement('div');
    this.modal.id = 'periodic-table-modal';
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
    this.updateGrid();
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

  updateGrid() {
    this.modal.innerHTML = `
      <div class="modal-dialog periodic-dialog">
        <div class="modal-header">
          <div class="modal-title">
            <span class="pulsing-dot"></span>
            J.A.R.V.I.S. QUANTUM PERIODIC MATRIX (ALL 118 ELEMENTS)
          </div>
          <button id="close-ptable-btn" class="close-btn">✕</button>
        </div>

        <div class="modal-controls">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="ptable-search" placeholder="Search element by name, symbol, or Z (e.g. Iron, Fe, 26)..." value="${this.searchQuery}">
          </div>

          <div class="filter-pills" id="ptable-filters">
            <button class="filter-pill ${this.activeFilter === 'all' ? 'active' : ''}" data-cat="all">All Elements</button>
            <button class="filter-pill ${this.activeFilter === 'reactive-nonmetal' ? 'active' : ''}" data-cat="reactive-nonmetal">Nonmetals</button>
            <button class="filter-pill ${this.activeFilter === 'noble-gas' ? 'active' : ''}" data-cat="noble-gas">Noble Gases</button>
            <button class="filter-pill ${this.activeFilter === 'alkali-metal' ? 'active' : ''}" data-cat="alkali-metal">Alkali Metals</button>
            <button class="filter-pill ${this.activeFilter === 'alkaline-earth' ? 'active' : ''}" data-cat="alkaline-earth">Alkaline Earth</button>
            <button class="filter-pill ${this.activeFilter === 'transition-metal' ? 'active' : ''}" data-cat="transition-metal">Transition</button>
            <button class="filter-pill ${this.activeFilter === 'lanthanide' ? 'active' : ''}" data-cat="lanthanide">Lanthanides</button>
            <button class="filter-pill ${this.activeFilter === 'actinide' ? 'active' : ''}" data-cat="actinide">Actinides</button>
            <button class="filter-pill ${this.activeFilter === 'superheavy' ? 'active' : ''}" data-cat="superheavy">Stark Synthetics</button>
          </div>
        </div>

        <div class="ptable-grid-container">
          <div class="ptable-grid" id="ptable-cells"></div>
        </div>

        <div class="modal-footer">
          <div class="hint-text">
            💡 Select any element to reconstruct subatomic nucleus and electron orbitals in holographic 3D.
          </div>
          <div class="current-badge">
            Current: <strong>${this.state.currentElement.name} (${this.state.currentElement.symbol})</strong> Z=${this.state.currentElement.atomicNumber}
          </div>
        </div>
      </div>
    `;

    // Hook events
    this.modal.querySelector('#close-ptable-btn').onclick = () => this.close();

    const searchInput = this.modal.querySelector('#ptable-search');
    searchInput.oninput = (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.populateCells();
    };

    const filterContainer = this.modal.querySelector('#ptable-filters');
    filterContainer.onclick = (e) => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      this.activeFilter = btn.dataset.cat;
      filterContainer.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.populateCells();
    };

    this.populateCells();
  }

  populateCells() {
    const grid = this.modal.querySelector('#ptable-cells');
    if (!grid) return;
    grid.innerHTML = '';

    const query = this.searchQuery;
    const filter = this.activeFilter;

    ELEMENTS.forEach((el, index) => {
      // Filtering check
      const matchesSearch = !query ||
        el.name.toLowerCase().includes(query) ||
        el.symbol.toLowerCase().includes(query) ||
        el.atomicNumber.toString() === query;

      const matchesFilter = filter === 'all' || el.category === filter;

      if (!matchesSearch || !matchesFilter) return;

      const cell = document.createElement('div');
      cell.className = `ptable-cell ${el.category} ${el.atomicNumber === this.state.currentElement.atomicNumber ? 'is-active' : ''}`;
      cell.style.borderColor = el.color;

      // Group & Period grid positioning for periodic layout
      if (el.group && el.period && !query && filter === 'all') {
        cell.style.gridColumn = el.group;
        cell.style.gridRow = el.period;
      }

      cell.innerHTML = `
        <div class="cell-num">${el.atomicNumber}</div>
        <div class="cell-sym" style="color: ${el.color}">${el.symbol}</div>
        <div class="cell-name">${el.name}</div>
        <div class="cell-mass">${el.atomicMass ? el.atomicMass.toFixed(1) : ''}</div>
      `;

      cell.onclick = () => {
        this.state.setElementByIndex(index);
        this.close();
      };

      grid.appendChild(cell);
    });
  }
}
