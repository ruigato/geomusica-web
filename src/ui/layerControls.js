// Remove the TEST STAR CUTS button in the UI controls
function createPolygonTypeControls(container, state) {
  // Create dropdown for polygon type
  const selectBox = document.createElement('select');
  selectBox.id = 'polygonTypeSelect';
  selectBox.className = 'custom-select';
  
  const options = [
    { value: 'regular', text: 'Regular Polygon' },
    { value: 'star', text: 'Star Polygon' },
    { value: 'euclidean', text: 'Euclidean Rhythm' },
    { value: 'fractal', text: 'Fractal Polygon' }
  ];
  
  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.text;
    if (state && state.shapeType === option.value) {
      opt.selected = true;
    }
    selectBox.appendChild(opt);
  });
  
  // Update state when polygon type changes
  selectBox.addEventListener('change', function() {
    if (state) {
      state.shapeType = this.value;
      // Check if we need to show/hide certain controls based on type
      updateControlsVisibility(state);
      // Force update
      if (typeof state.updateGeometry === 'function') {
        state.updateGeometry();
      }
    }
  });
  
  // Create label
  const label = document.createElement('label');
  label.textContent = 'Polygon Type:';
  label.htmlFor = 'polygonTypeSelect';
  
  // Add to container
  const controlWrapper = document.createElement('div');
  controlWrapper.className = 'control-wrapper polygon-type-control';
  controlWrapper.appendChild(label);
  controlWrapper.appendChild(selectBox);
  container.appendChild(controlWrapper);
  
  // Create Star controls if needed
  createStarControls(container, state);
  
  // Create Euclidean controls
  createEuclideanControls(container, state);
  
  // Create Fractal controls
  createFractalControls(container, state);
  
  // Set initial visibility
  updateControlsVisibility(state);
} 