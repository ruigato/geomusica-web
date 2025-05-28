// src/ui/headerTabs.js - Handles header tab functionality

/**
 * Initializes the header tabs functionality
 */
export function setupHeaderTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Set up tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Update active button
      tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === targetTab) {
          btn.classList.add('active');
          btn.style.backgroundColor = '#555';
        } else {
          btn.classList.remove('active');
          btn.style.backgroundColor = '#333';
        }
      });
      
      // Hide all tab contents and show the target one
      tabContents.forEach(content => {
        if (content.id === targetTab + '-tab') {
          content.style.display = 'block';
        } else {
          content.style.display = 'none';
        }
      });
    });
  });
  
  // Set up expand/collapse all buttons
  const expandAllButton = document.getElementById('expand-all-btn');
  const collapseAllButton = document.getElementById('collapse-all-btn');
  const resetLayersButton = document.getElementById('reset-layers-btn');
  
  if (expandAllButton) {
    expandAllButton.addEventListener('click', () => {
      expandAllSections();
    });
  }
  
  if (collapseAllButton) {
    collapseAllButton.addEventListener('click', () => {
      collapseAllSections();
    });
  }
  
  if (resetLayersButton) {
    resetLayersButton.addEventListener('click', () => {
      resetAllLayers();
    });
  }
}

/**
 * Expands all collapsible sections
 */
function expandAllSections() {
  const sections = document.querySelectorAll('section');
  
  sections.forEach(section => {
    const header = section.querySelector('h2');
    const content = section.querySelector('.section-content');
    
    if (header && content) {
      // Remove collapsed class from all elements
      section.classList.remove('collapsed');
      
      if (header.classList.contains('section-title')) {
        header.classList.remove('collapsed');
        content.classList.remove('collapsed');
      }
      
      // Update localStorage
      const sectionId = header.textContent.trim().replace(/\s+/g, '_').toLowerCase();
      localStorage.setItem(`section_${sectionId}_collapsed`, 'false');
    }
  });
}

/**
 * Collapses all collapsible sections
 */
function collapseAllSections() {
  const sections = document.querySelectorAll('section');
  
  sections.forEach(section => {
    const header = section.querySelector('h2');
    const content = section.querySelector('.section-content');
    
    if (header && content) {
      // Add collapsed class to all elements
      section.classList.add('collapsed');
      
      if (header.classList.contains('section-title')) {
        header.classList.add('collapsed');
        content.classList.add('collapsed');
      }
      
      // Update localStorage
      const sectionId = header.textContent.trim().replace(/\s+/g, '_').toLowerCase();
      localStorage.setItem(`section_${sectionId}_collapsed`, 'true');
    }
  });
}

/**
 * Resets the active layer to its default configuration
 */
function resetAllLayers() {
  // Show confirmation dialog
  if (confirm('Reset the active layer to default values? This will restore the default settings while keeping the current color.')) {
    try {
      // Get the layer manager
      const layerManager = window._layers;
      
      if (!layerManager) {
        console.error('Layer manager not found');
        alert('Error: Layer manager not available');
        return;
      }
      
      // Get the active layer
      const activeLayer = layerManager.getActiveLayer();
      if (!activeLayer) {
        console.error('No active layer found');
        alert('Error: No active layer found');
        return;
      }
      
      // Reset the active layer to defaults (this method preserves color internally)
      const success = layerManager.resetLayerToDefaults(layerManager.activeLayerId);
      
      if (success) {
        console.log(`Successfully reset Layer ${layerManager.activeLayerId + 1} to defaults`);
        
        // Update the layer UI if the function exists
        if (typeof window.updateLayerButtons === 'function') {
          window.updateLayerButtons(layerManager);
        }
        
        // Force a complete UI sync
        if (typeof window.syncStateAcrossSystems === 'function') {
          window.syncStateAcrossSystems(true);
        }
        
        // Show success message
        console.log(`Layer ${layerManager.activeLayerId + 1} reset to default values`);
      } else {
        console.error('Failed to reset layer');
        alert('Error: Failed to reset layer');
      }
    } catch (error) {
      console.error('Error resetting layer:', error);
      alert('Error: ' + error.message);
    }
  }
} 