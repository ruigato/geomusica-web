export class LayerUI {
  constructor(container, app) {
    this.container = container;
    this.app = app;
    this.draggedItem = null;
    
    // Create main container
    this.panel = document.createElement('div');
    this.panel.className = 'layers-panel';
    this.container.appendChild(this.panel);
    
    // Create header
    const header = document.createElement('div');
    header.className = 'layers-header';
    header.textContent = 'Layers';
    this.panel.appendChild(header);
    
    // Create layers container
    this.layersList = document.createElement('div');
    this.layersList.className = 'layers-list';
    this.panel.appendChild(this.layersList);
    
    // Create controls
    this.controls = document.createElement('div');
    this.controls.className = 'layers-controls';
    this.panel.appendChild(this.controls);
    
    // Add new layer button
    this.addButton = document.createElement('button');
    this.addButton.className = 'add-layer-button';
    this.addButton.innerHTML = '<span class="icon">+</span> Add Layer';
    this.controls.appendChild(this.addButton);
    
    this.setupEventListeners();
    this.render();
    
    // Store the previous render function to be able to remove it later
    this._renderFn = () => this.render();
    
    // Subscribe to state changes if available
    this.setupStateSubscription();
  }

  setupEventListeners() {
    // Single click handler for the entire layers list
    this.layersList.addEventListener('click', (e) => {
      // Check for layer item click
      const clickedLayerItem = e.target.closest('.layer-item');
      if (clickedLayerItem) {
        const layerId = clickedLayerItem.dataset.layerId;
        if (layerId) {
          this.app.setActiveLayer(layerId);
        }
        return;
      }
      
      // Check for visibility toggle
      const toggle = e.target.closest('.visibility-toggle');
      if (toggle) {
        e.stopPropagation();
        const layerItem = toggle.closest('.layer-item');
        const layerId = layerItem.dataset.layerId;
        const isVisible = toggle.textContent === '👁️';
        this.app.toggleLayerVisibility(layerId, !isVisible);
        return;
      }
      
      // Layer deletion
      const deleteBtn = e.target.closest('.delete-layer');
      if (deleteBtn) {
        e.stopPropagation();
        const layerId = deleteBtn.dataset.layerId;
        if (confirm('Are you sure you want to delete this layer?')) {
          this.app.removeLayer(layerId);
        }
        return;
      }
    });
    
    // Add new layer
    this.addButton.addEventListener('click', () => {
      this.app.addLayer();
    });
    
    // Setup drag and drop
    this.setupDragAndDrop();
  }
  
  /**
   * Set up state change subscription if available
   */
  setupStateSubscription() {
    if (typeof this.app.state?.on === 'function') {
      // If using EventEmitter-style state
      this.app.state.on('layers:changed', this._renderFn);
      this._unsubscribe = () => {
        this.app.state.off('layers:changed', this._renderFn);
      };
    } else if (typeof this.app.state?.subscribe === 'function') {
      // If using subscribe/unsubscribe pattern
      this._unsubscribe = this.app.state.subscribe(this._renderFn);
    } else {
      console.warn('State object does not support event subscriptions');
      // Fallback to polling if needed
      this._pollInterval = setInterval(() => this.render(), 1000);
    }
  }

  /**
   * Clean up event listeners and subscriptions
   */
  destroy() {
    // Unsubscribe from state changes
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    
    // Clear any polling intervals
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    
    // Remove DOM event listeners
    this.layersList.replaceWith(this.layersList.cloneNode(true));
    this.addButton.replaceWith(this.addButton.cloneNode(true));
  }
  
  setupDragAndDrop() {
    this.layersList.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.layer-item');
      if (!item) return;
      
      this.draggedItem = item;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.layerId);
      item.classList.add('dragging');
    });
    
    this.layersList.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = this.getDragAfterElement(this.layersList, e.clientY);
      const draggable = document.querySelector('.dragging');
      
      if (afterElement) {
        this.layersList.insertBefore(draggable, afterElement);
      } else {
        this.layersList.appendChild(draggable);
      }
    });
    
    this.layersList.addEventListener('dragend', (e) => {
      const item = e.target.closest('.layer-item');
      if (!item) return;
      
      item.classList.remove('dragging');
      this.updateLayerOrder();
    });
    
    this.layersList.addEventListener('dragenter', (e) => e.preventDefault());
    this.layersList.addEventListener('dragleave', (e) => e.preventDefault());
    this.layersList.addEventListener('drop', (e) => e.preventDefault());
  }
  
  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.layer-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
  
  updateLayerOrder() {
    const layerItems = Array.from(this.layersList.querySelectorAll('.layer-item'));
    const newOrder = layerItems.map(item => item.dataset.layerId);
    this.app.reorderLayers(newOrder);
  }

  render() {
    const { layers } = this.app.state;
    const activeLayerId = layers.activeLayerId;
    
    // Store scroll position
    const scrollTop = this.layersList.scrollTop;
    
    // Clear the list
    this.layersList.innerHTML = '';
    
    // Add layers in order (top to bottom = first to last in array)
    layers.list.forEach(layerId => {
      const layer = layers.byId[layerId];
      if (!layer) return;
      
      const isActive = layerId === activeLayerId;
      
      const layerEl = document.createElement('div');
      layerEl.className = `layer-item ${isActive ? 'active' : ''} ${layer.visible ? 'visible' : 'hidden'}`;
      layerEl.dataset.layerId = layerId;
      layerEl.draggable = true;
      
      // Set opacity based on layer's own opacity
      layerEl.style.opacity = layer.opacity || 1;
      
      layerEl.innerHTML = `
        <div class="layer-handle" title="Drag to reorder">☰</div>
        <span class="visibility-toggle" title="${layer.visible ? 'Hide' : 'Show'} layer">
          ${layer.visible ? '👁️' : '👁️‍🗨️'}
        </span>
        <span class="layer-name" title="${layer.name}">${layer.name}</span>
        <div class="layer-actions">
          <button class="layer-action-btn lock-toggle" title="Lock/Unlock layer">
            ${layer.locked ? '🔒' : '🔓'}
          </button>
          <button class="layer-action-btn delete-layer" title="Delete layer" data-layer-id="${layerId}">
            🗑️
          </button>
        </div>
      `;
      
      this.layersList.appendChild(layerEl);
    });
    
    // Restore scroll position
    this.layersList.scrollTop = scrollTop;
  }
}
