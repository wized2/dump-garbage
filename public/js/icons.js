/**
 * Endroid OS - Offline Lucide Icon Utility
 * Provides fast, offline icon rendering and dynamic DOM injection.
 */
(function(window) {
  'use strict';

  const Icons = {
    /**
     * Initializes all Lucide icons in the DOM or inside a specific container element.
     * @param {HTMLElement} [rootElement=document]
     */
    render: function(rootElement = document) {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons({
          root: rootElement,
          attrs: {
            'stroke-width': 1.8
          }
        });
      }
    },

    /**
     * Returns an HTML string for an icon with custom size and class names.
     * @param {string} name - Lucide icon name (e.g. 'folder', 'terminal', 'settings')
     * @param {Object} [options={}]
     * @returns {string} HTML string
     */
    getHtml: function(name, options = {}) {
      const size = options.size || 20;
      const cls = options.className || '';
      const stroke = options.strokeWidth || 1.8;
      return `<i data-lucide="${name}" class="lucide-icon ${cls}" style="width:${size}px; height:${size}px;" data-stroke-width="${stroke}"></i>`;
    },

    /**
     * Creates an icon DOM node directly.
     * @param {string} name 
     * @param {Object} [options={}] 
     * @returns {HTMLElement}
     */
    createElement: function(name, options = {}) {
      const span = document.createElement('span');
      span.className = 'icon-wrapper ' + (options.className || '');
      span.innerHTML = this.getHtml(name, options);
      this.render(span);
      return span.firstElementChild || span;
    }
  };

  window.EndroidIcons = Icons;
})(window);
