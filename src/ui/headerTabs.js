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