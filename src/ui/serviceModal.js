"use strict";

/**
 * Service Modal Manager
 * Handles modal for service selection
 */
class ServiceModal {
  
  constructor() {
    this.modal = null;
    this.serviceGrid = null;
    this.customServices = [];
    this.hiddenServices = new Set();
    this.isShiftHeld = false;
    
    // Standard services configuration
    this.standardServices = [
      { name: 'Mapbox Standard', urlTemplate: 'https://labs.mapbox.com/standard-style/#{{zoom}}/{{lat}}/{{lon}}', color: '#1A73E8', backgroundImage: 'https://labs.mapbox.com/favicon.ico' },
      { name: '3D Buildings Box', urlTemplate: 'https://hey.mapbox.com/3D-Buildings-Box/#{{zoom}}/{{lat}}/{{lon}}/{{bearing}}/{{pitch}}', color: '#FF9800', backgroundImage: 'https://www.mapbox.com/favicon.ico' },
      { name: 'Labs HD Roads', urlTemplate: 'https://labs.mapbox.com/hd-roads/?lightPreset=satellite#{{zoom}}/{{lat}}/{{lon}}/{{bearing}}/{{pitch}}', color: '#9C27B0', backgroundImage: 'https://labs.mapbox.com/favicon.ico', altUrlTemplate: 'https://labs.mapbox.com/hd-roads/?lightPreset=day&source=3dln#{{zoom}}/{{lat}}/{{lon}}/{{bearing}}/{{pitch}}', hasShiftModifier: true },
      { name: 'HD Roads Prod', urlTemplate: 'https://console.mapbox.com/studio/tilesets/mapbox.hd-road-v1-bounded/#{{zoom}}/{{lat}}/{{lon}}', color: '#00BCD4', backgroundImage: 'https://www.mapbox.com/favicon.ico', isTileset: true, altUrlTemplate: 'https://console.mapbox.com/studio/tilesets/mapbox.hd-road-v1-bounded-demo/#{{zoom}}/{{lat}}/{{lon}}/{{bearing}}', hasShiftModifier: true },
      { name: '3DLN Demo Style', urlTemplate: 'https://api.mapbox.com/styles/v1/mapbox-3dln/mbx-3d-line-navigation-demo-style.html?title=view&access_token=pk.eyJ1IjoibWFwYm94LTNkbG4iLCJhIjoiY200djloOGQ2MDBmNDJpc2J5OHVtdDVkNCJ9.-Lbyn-czRBlAxwl-yNWdTg&zoomwheel=true&fresh=true#{{zoom}}/{{lat}}/{{lon}}', color: '#E91E63', backgroundImage: 'https://www.mapbox.com/favicon.ico' },
      { name: 'Google Maps', urlTemplate: 'https://www.google.com/maps/@{{lat}},{{lon}},{{zoom}}z', color: '#4285F4', backgroundImage: 'https://www.google.com/favicon.ico', altUrlTemplate: 'https://earth.google.com/web/@{{lat}},{{lon}},{{zoom}}a,0y,0h,0t,0r', hasShiftModifier: true },
      { name: 'Direction Debug', urlTemplate: 'https://console.mapbox.com/directions-debug/#map={{lon}},{{lat}},{{zoom}}z', color: '#00BCD4', backgroundImage: 'https://www.mapbox.com/favicon.ico' },
      { name: '3D Model Slots', urlTemplate: 'https://sites.mapbox.com/mbx-3dbuilding-tools-staging/#/model-slots/2022-10-10/map/?center={{zoom}}%2F{{lon}}%2F{{lat}}&jira_summary=&jira_status=&jira_issue_id=&jira_labels=&jira_fix_versions=&env=prod&city=&iso_3166_1_alpha3=&lights=day&colorization=', color: '#9C27B0', backgroundImage: 'https://www.mapbox.com/favicon.ico', altUrlTemplate: 'https://sites.mapbox.com/mbx-3dbuilding-tools-staging/#/footprint/?center={{zoom}}%2F{{lon}}%2F{{lat}}', hasShiftModifier: true },
      { name: 'OpenStreetMap', urlTemplate: 'https://www.openstreetmap.org/#map={{zoom}}/{{lat}}/{{lon}}', color: '#7EBC6F', backgroundImage: 'https://www.openstreetmap.org/favicon.ico' },
      { name: 'Bing Maps', urlTemplate: 'https://www.bing.com/maps?cp={{lat}}~{{lon}}&lvl={{zoom}}', color: '#008373', backgroundImage: 'https://www.bing.com/favicon.ico' },
      { name: 'Yandex Maps', urlTemplate: 'https://yandex.by/maps/?ll={{lon}},{{lat}}&z={{zoom}}', color: '#FF0000', backgroundImage: 'https://yandex.by/favicon.ico' },
    ];
  }
  
  /**
   * Initialize modal
   */
  async init() {
    this.serviceGrid = document.getElementById('service-grid');
    
    if (!this.serviceGrid) {
      console.error('Service grid not found');
      return;
    }
    
    this.loadCustomServices();
    this.loadHiddenServices();
    
    // Render services without blocking - coordinates will load in background
    this.renderServices().catch(err => {
      console.error("Error rendering services:", err);
    });
    
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupShiftIndicator();
  }
  
  /**
   * Setup Shift key visual indicator for 3D Buildings Box
   */
  setupShiftIndicator() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift' || e.keyCode === 16 || e.shiftKey) {
        this.isShiftHeld = true;
        // Add class to body when shift is held for CSS styling
        document.body.classList.add('shift-held');
        
        // Update button names for buttons with shift modifier
        this.updateButtonNames(true);
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift' || e.keyCode === 16) {
        this.isShiftHeld = false;
        // Remove class from body
        document.body.classList.remove('shift-held');
        
        // Restore original button names
        this.updateButtonNames(false);
      }
    });
  }
  
  /**
   * Update button names when shift is held
   */
  updateButtonNames(shiftHeld) {
    const buttons = this.serviceGrid?.querySelectorAll('.service-btn');
    if (!buttons) return;
    
    buttons.forEach(btn => {
      const serviceName = btn.dataset.serviceName;
      
      // Update 3D Buildings Box name
      if (serviceName === '3D Buildings Box') {
        const nameSpan = btn.querySelector('span:not(.service-hotkey-badge):not(.service-delete-btn)');
        if (nameSpan) {
          nameSpan.textContent = shiftHeld ? '3DLN Demo Box' : '3D Buildings Box';
        }
      }
      
      // Update HD Roads Prod name
      if (serviceName === 'HD Roads Prod') {
        const nameSpan = btn.querySelector('span:not(.service-hotkey-badge):not(.service-delete-btn)');
        if (nameSpan) {
          nameSpan.textContent = shiftHeld ? 'HD Roads Demo' : 'HD Roads Prod';
        }
      }
      
      // Update Google Maps name
      if (serviceName === 'Google Maps') {
        const nameSpan = btn.querySelector('span:not(.service-hotkey-badge):not(.service-delete-btn)');
        if (nameSpan) {
          nameSpan.textContent = shiftHeld ? 'Google Earth' : 'Google Maps';
        }
      }
      
      // Update 3D Model Slots name
      if (serviceName === '3D Model Slots') {
        const nameSpan = btn.querySelector('span:not(.service-hotkey-badge):not(.service-delete-btn)');
        if (nameSpan) {
          nameSpan.textContent = shiftHeld ? 'Footprint' : '3D Model Slots';
        }
      }
      
      // Update Labs HD Roads name
      if (serviceName === 'Labs HD Roads') {
        const nameSpan = btn.querySelector('span:not(.service-hotkey-badge):not(.service-delete-btn)');
        if (nameSpan) {
          nameSpan.textContent = shiftHeld ? 'Labs HD 3DLN Demo' : 'Labs HD Roads';
        }
      }
    });
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const addCustomBtn = document.getElementById('add-custom-service');
    
    if (addCustomBtn) {
      addCustomBtn.addEventListener('click', () => this.promptAddCustomService());
    }
  }
  
  /**
   * Get current coordinates
   * Always gets fresh coordinates from current tab to avoid stale data
   */
  async getCurrentCoordinates() {
    try {
      const app = window.appInstance;
      
      // Always re-extract coordinates from current tab to get latest values
      // This ensures we don't use stale coordinates from previous pages
      if (app && app.extractCurrentTabCoordinates) {
        await app.extractCurrentTabCoordinates();
      }
      
      // Get coordinates from active slot after refreshing
      if (app && app.getActiveSlotCoordinates) {
        const coords = await app.getActiveSlotCoordinates();
        
        if (coords && coords.lat && coords.lon) {
          UIComponents.Logger.log(`Using coordinates from active slot: ${coords.lat}, ${coords.lon}`, "info");
          return coords;
        }
      }
      
      // Fallback: try to get from slot 0
      const slot = await StorageManager.getSlot(0);
      if (slot && slot.lat && slot.lon) {
        UIComponents.Logger.log(`Using coordinates from slot 0: ${slot.lat}, ${slot.lon}`, "info");
        return slot;
      }
      
      // No coordinates found - log warning
      UIComponents.Logger.log("No coordinates available. Please navigate to a page with coordinates in the URL.", "error");
      return null;
    } catch (error) {
      console.error('Error getting coordinates:', error);
      UIComponents.Logger.log(`Error getting coordinates: ${error.message}`, "error");
      return null;
    }
  }
  
  /**
   * Render service buttons
   */
  async renderServices() {
    if (!this.serviceGrid) return;
    
    // Render services immediately, load coordinates in background (non-blocking)
    this.serviceGrid.innerHTML = '';
    
    // Get visible services order from localStorage
    const visibleOrder = this.getVisibleServicesOrder();
    
    // Render all services in order
    visibleOrder.forEach((serviceName, index) => {
      const service = this.standardServices.find(s => s.name === serviceName) || 
                     this.customServices.find(s => s.name === serviceName);
      if (service && !this.hiddenServices.has(serviceName)) {
        const btn = this.createServiceButton(service, this.customServices.includes(service), index);
        btn.draggable = true;
        btn.dataset.dragIndex = index;
        this.serviceGrid.appendChild(btn);
      }
    });
    
    // Setup drag and drop
    this.setupDragAndDrop();
    
    // Load coordinates in background (non-blocking)
    this.getCurrentCoordinates().then(coords => {
      this.currentCoords = coords;
    }).catch(err => {
      console.error("Error getting current coordinates:", err);
    });
  }
  
  /**
   * Setup drag and drop for reordering services
   */
  setupDragAndDrop() {
    const buttons = this.serviceGrid.querySelectorAll('.service-btn');
    
    buttons.forEach(button => {
      button.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', button.dataset.serviceName);
        button.style.opacity = '0.5';
        button.style.cursor = 'grabbing';
        
        // Add a placeholder indicator
        const rect = button.getBoundingClientRect();
        button.dataset.originalHeight = rect.height;
      });
      
      button.addEventListener('dragend', (e) => {
        button.style.opacity = '1';
        button.style.cursor = 'grab';
        button.style.marginTop = '0';
        
        // Remove all drop indicators
        buttons.forEach(btn => {
          btn.classList.remove('drop-target');
        });
      });
      
      button.addEventListener('dragenter', (e) => {
        const draggedButton = document.querySelector('.service-btn[style*="opacity: 0.5"]');
        if (!draggedButton) return;
        
        const currentButton = e.target.closest('.service-btn');
        
        if (currentButton && currentButton !== draggedButton) {
          // Remove all existing drop indicators
          this.serviceGrid.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
          
          // Determine if we should show indicator above or below
          const rect = currentButton.getBoundingClientRect();
          const mouseY = e.clientY;
          const insertBefore = mouseY < rect.top + rect.height / 2;
          
          // Create drop indicator
          const indicator = document.createElement('div');
          indicator.className = 'drop-indicator';
          indicator.style.width = '100%';
          indicator.style.height = '2px';
          indicator.style.background = '#919AA8';
          indicator.style.margin = '0 0 -2px 0';
          indicator.style.transition = 'all 0.2s ease';
          
          if (insertBefore) {
            currentButton.parentNode.insertBefore(indicator, currentButton);
          } else {
            currentButton.parentNode.insertBefore(indicator, currentButton.nextSibling);
          }
        }
      });
      
      button.addEventListener('dragleave', (e) => {
        // Check if we're leaving the button area
        const relatedTarget = e.relatedTarget;
        if (!relatedTarget || !button.contains(relatedTarget)) {
          button.parentElement.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
        }
      });
      
      button.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const draggedButton = document.querySelector('.service-btn[style*="opacity: 0.5"]');
        if (!draggedButton) return;
        
        const targetButton = e.target.closest('.service-btn');
        if (targetButton && targetButton !== draggedButton) {
          const allButtons = Array.from(this.serviceGrid.querySelectorAll('.service-btn'));
          const draggedIndex = allButtons.indexOf(draggedButton);
          const targetIndex = allButtons.indexOf(targetButton);
          
          // Determine position
          const rect = targetButton.getBoundingClientRect();
          const mouseY = e.clientY;
          const halfHeight = rect.height / 2;
          const insertAfter = mouseY > rect.top + halfHeight;
          
          if (insertAfter && draggedIndex < targetIndex) {
            this.serviceGrid.insertBefore(draggedButton, targetButton.nextSibling);
          } else if (!insertAfter && draggedIndex > targetIndex) {
            this.serviceGrid.insertBefore(draggedButton, targetButton);
          }
        }
      });
      
      button.addEventListener('drop', (e) => {
        e.preventDefault();
        const draggedName = e.dataTransfer.getData('text/plain');
        
        // Update order in localStorage
        const newOrder = Array.from(this.serviceGrid.querySelectorAll('.service-btn')).map(btn => btn.dataset.serviceName);
        this.saveServicesOrder(newOrder);
        
        // Re-render to update hotkey badges
        this.renderServices();
      });
    });
  }
  
  /**
   * Toggle service visibility (hide/show)
   */
  toggleServiceVisibility(serviceName) {
    if (this.hiddenServices.has(serviceName)) {
      this.hiddenServices.delete(serviceName);
    } else {
      this.hiddenServices.add(serviceName);
    }
    this.saveHiddenServices();
    this.renderServices();
  }
  
  /**
   * Get visible services order
   */
  getVisibleServicesOrder() {
    try {
      const saved = localStorage.getItem('coordinate_extractor_services_order');
      if (saved) {
        const order = JSON.parse(saved);
        // Filter out hidden services
        return order.filter(name => !this.hiddenServices.has(name));
      }
    } catch (error) {
      console.error('Error loading services order:', error);
    }
    
    // Default order: all standard services + custom (excluding hidden)
    const allServices = [
      ...this.standardServices.map(s => s.name),
      ...this.customServices.map(s => s.name)
    ];
    return allServices.filter(name => !this.hiddenServices.has(name));
  }
  
  /**
   * Save visible services order
   */
  saveServicesOrder(order) {
    try {
      localStorage.setItem('coordinate_extractor_services_order', JSON.stringify(order));
    } catch (error) {
      console.error('Error saving services order:', error);
    }
  }
  
  /**
   * Save hidden services
   */
  saveHiddenServices() {
    try {
      localStorage.setItem('coordinate_extractor_hidden_services', JSON.stringify(Array.from(this.hiddenServices)));
    } catch (error) {
      console.error('Error saving hidden services:', error);
    }
  }
  
  /**
   * Load hidden services
   */
  loadHiddenServices() {
    try {
      const saved = localStorage.getItem('coordinate_extractor_hidden_services');
      if (saved) {
        this.hiddenServices = new Set(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading hidden services:', error);
      this.hiddenServices = new Set();
    }
  }
  
  /**
   * Create service button
   */
  createServiceButton(service, isCustom = false, index = null) {
    const btn = document.createElement('button');
    btn.className = 'service-btn';
    
    // Create left content
    const leftContent = document.createElement('div');
    leftContent.style.display = 'flex';
    leftContent.style.alignItems = 'center';
    leftContent.style.gap = '6px';
    
    // Add hotkey badge for first 9 services
    if (index !== null && index < 9) {
      const hotkeyBadge = document.createElement('span');
      hotkeyBadge.textContent = index + 1;
      hotkeyBadge.className = 'service-hotkey-badge';
      hotkeyBadge.style.background = 'rgba(145, 154, 168, 0.30)';
      hotkeyBadge.style.color = '#4F5D75';
      hotkeyBadge.style.fontSize = '11px';
      hotkeyBadge.style.fontWeight = '600';
      hotkeyBadge.style.padding = '2px 6px';
      hotkeyBadge.style.borderRadius = '3px';
      leftContent.appendChild(hotkeyBadge);
    }
    
    const serviceName = document.createElement('span');
    serviceName.textContent = service.name;
    serviceName.style.flex = '1';
    leftContent.appendChild(serviceName);
    
    // Add visual tileset marker if applicable
    if (service.isTileset) {
      const tilesetMarker = document.createElement('span');
      tilesetMarker.textContent = '▫';
      tilesetMarker.style.color = '#919AA8';
      tilesetMarker.style.fontSize = '14px';
      tilesetMarker.style.marginLeft = '4px';
      tilesetMarker.style.opacity = '0.6';
      tilesetMarker.title = 'Tileset';
      leftContent.appendChild(tilesetMarker);
    }
    
    btn.appendChild(leftContent);
    btn.dataset.serviceName = service.name;
    
    // Mark buttons with additional functionality (Shift modifier)
    if (service.name === '3D Buildings Box' || service.name === '3D Model Slots' || service.name === 'Labs HD Roads' || service.hasShiftModifier) {
      btn.classList.add('has-shift-modifier');
    }
    
    // Set button to have relative positioning for absolute children
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    
    // Add background image with blur and grain effect
    if (service.backgroundImage) {
      // Create background layer
      const bgOverlay = document.createElement('div');
      bgOverlay.className = 'service-bg-image';
      bgOverlay.style.position = 'absolute';
      bgOverlay.style.width = '100%';
      bgOverlay.style.height = '100%';
      bgOverlay.style.top = '0';
      bgOverlay.style.right = '0';
      bgOverlay.style.backgroundImage = `url(${service.backgroundImage})`;
      bgOverlay.style.backgroundSize = 'auto 120px';
      bgOverlay.style.backgroundPosition = '90% center';
      bgOverlay.style.backgroundRepeat = 'no-repeat';
      bgOverlay.style.filter = 'blur(30px) opacity(0.4) brightness(0.5)';
      bgOverlay.style.pointerEvents = 'none';
      bgOverlay.style.zIndex = '1';
      btn.appendChild(bgOverlay);
      
      // Add separate grain overlay layer
      const grainLayer = document.createElement('div');
      grainLayer.className = 'service-grain';
      grainLayer.style.position = 'absolute';
      grainLayer.style.width = '100%';
      grainLayer.style.height = '100%';
      grainLayer.style.top = '0';
      grainLayer.style.left = '0';
      grainLayer.style.background = `
        repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, transparent 1px),
        repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0px, transparent 1px),
        repeating-linear-gradient(45deg, rgba(255,255,255,0.01) 0px, transparent 2px)
      `;
      grainLayer.style.pointerEvents = 'none';
      grainLayer.style.zIndex = '2';
      btn.appendChild(grainLayer);
    }
    
    // Ensure content is above background
    leftContent.style.position = 'relative';
    leftContent.style.zIndex = '3';
    leftContent.style.backgroundColor = 'transparent';
    
    // Add colored left border and background tint
    this.getServiceColor(service.urlTemplate).then(color => {
      if (color) {
        btn.style.borderLeft = `3px solid ${color}`;
        btn.style.paddingLeft = '11px';
        
        // Add subtle background tint overlay
        const colorRGB = color.match(/\d+/g);
        if (colorRGB && colorRGB.length >= 3) {
          const r = parseInt(colorRGB[0]);
          const g = parseInt(colorRGB[1]);
          const b = parseInt(colorRGB[2]);
          
          const colorOverlay = document.createElement('div');
          colorOverlay.style.position = 'absolute';
          colorOverlay.style.width = '100%';
          colorOverlay.style.height = '100%';
          colorOverlay.style.top = '0';
          colorOverlay.style.left = '0';
          colorOverlay.style.background = `linear-gradient(to right, rgba(${r}, ${g}, ${b}, 0.08) 0%, transparent 30%, transparent 100%)`;
          colorOverlay.style.pointerEvents = 'none';
          colorOverlay.style.zIndex = '1';
          btn.appendChild(colorOverlay);
        }
      } else {
        // Fallback to service.color if available
        if (service.color) {
          btn.style.borderLeft = `3px solid ${service.color}`;
          btn.style.paddingLeft = '11px';
        }
      }
    }).catch(() => {
      // Fallback to service.color if fetch fails
      if (service.color) {
        btn.style.borderLeft = `3px solid ${service.color}`;
        btn.style.paddingLeft = '11px';
      }
    });
    
    
    if (isCustom) {
      btn.style.borderTop = '2px solid #FF9800';
      btn.style.borderBottom = '2px solid #FF9800';
      btn.style.borderRight = '2px solid #FF9800';
    }
    
    btn.addEventListener('click', (e) => {
      this.openService(service, e.shiftKey);
    });
    
    // Add delete button for all services
    const deleteBtn = document.createElement('span');
    deleteBtn.textContent = '×';
    deleteBtn.className = 'service-delete-btn';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleServiceVisibility(service.name);
    });
    btn.appendChild(deleteBtn);
    
    return btn;
  }
  
  /**
   * Open service in new tab
   */
  async openService(service, shiftKey = false) {
    // Always get fresh coordinates before opening service to avoid stale data
    const freshCoords = await this.getCurrentCoordinates();
    if (!freshCoords || !freshCoords.lat || !freshCoords.lon) {
      UIComponents.Logger.log(`Cannot open ${service.name}: No coordinates available. Please navigate to a page with coordinates in the URL.`, "error");
      return;
    }
    
    // Update currentCoords with fresh values
    this.currentCoords = freshCoords;
    
    UIComponents.Logger.log(`Opening ${service.name} with coordinates: ${freshCoords.lat}, ${freshCoords.lon}, zoom: ${freshCoords.zoom}`, "info");
    
    let url = this.buildServiceUrl(service.urlTemplate, this.currentCoords);
    
    if (service.name === '3D Buildings Box' && shiftKey) {
      const urlObj = new URL(url);
      urlObj.searchParams.set('basemap', '3dln-demo');
      url = urlObj.toString();
    }
    
    if (service.name === 'HD Roads Prod' && shiftKey && service.altUrlTemplate) {
      url = this.buildServiceUrl(service.altUrlTemplate, this.currentCoords);
    }
    
    if (service.name === 'Google Maps' && shiftKey && service.altUrlTemplate) {
      url = this.buildServiceUrl(service.altUrlTemplate, this.currentCoords);
    }
    
    if (service.name === '3D Model Slots' && shiftKey && service.altUrlTemplate) {
      url = this.buildServiceUrl(service.altUrlTemplate, this.currentCoords);
    }
    
    if (service.name === 'Labs HD Roads' && shiftKey && service.altUrlTemplate) {
      url = this.buildServiceUrl(service.altUrlTemplate, this.currentCoords);
    }
    
    if (shiftKey && service.altUrlTemplate && this.customServices.includes(service)) {
      url = this.buildServiceUrl(service.altUrlTemplate, this.currentCoords);
    }
    
    if (url) {
      // Use Chrome Tabs API instead of window.open for better control
      chrome.tabs.create({ url: url, active: true });
      UIComponents.Logger.log(`Opening ${service.name}`, "success");
      // Note: Service modal doesn't need to be closed - it's not a modal, just a grid of services
    } else {
      UIComponents.Logger.log("Failed to build URL", "error");
    }
  }
  
  /**
   * Get service color from URL theme
   */
  async getServiceColor(urlTemplate) {
    try {
      // Extract domain from URL template
      const urlMatch = urlTemplate.match(/https?:\/\/([^\/\s]+)/);
      if (!urlMatch) return null;
      
      const domain = urlMatch[1];
      
      // Try to get favicon and extract dominant color
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Calculate dominant color
            let r = 0, g = 0, b = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
              count++;
            }
            
            if (count > 0) {
              r = Math.floor(r / count);
              g = Math.floor(g / count);
              b = Math.floor(b / count);
              resolve(`rgb(${r}, ${g}, ${b})`);
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = faviconUrl;
      });
    } catch (error) {
      console.error('Error getting service color:', error);
      return null;
    }
  }
  
  /**
   * Build service URL from template
   */
  buildServiceUrl(template, coords) {
    try {
      if (!coords || !coords.lat || !coords.lon) {
        console.error('Invalid coordinates:', coords);
        return null;
      }
      
      // Replace basic coordinates
      let url = template
        .replace(/\{\{lat\}\}/g, coords.lat || '')
        .replace(/\{\{lon\}\}/g, coords.lon || '')
        .replace(/\{\{zoom\}\}/g, coords.zoom || '15');
      
      // Handle pitch and bearing for Mapbox-style URLs (#zoom/lat/lon/bearing/pitch)
      const hasBearing = coords.bearing !== undefined && coords.bearing !== null;
      const hasPitch = coords.pitch !== undefined && coords.pitch !== null;
      
      if (url.includes('/{{bearing}}/{{pitch}}')) {
        if (hasBearing && hasPitch) {
          url = url.replace(/\{\{bearing\}\}/g, coords.bearing);
          url = url.replace(/\{\{pitch\}\}/g, coords.pitch);
        } else {
          // Remove the /bearing/pitch part if not available
          url = url.replace(/\/\{\{bearing\}\}\/\{\{pitch\}\}/g, '');
        }
      } else {
        // Individual replacements
        if (hasPitch) {
          url = url.replace(/\{\{pitch\}\}/g, coords.pitch);
        } else if (url.includes('{{pitch}}')) {
          url = url.replace(/\{\{pitch\}\}/g, '');
        }
        
        if (hasBearing) {
          url = url.replace(/\{\{bearing\}\}/g, coords.bearing);
        } else if (url.includes('{{bearing}}')) {
          url = url.replace(/\{\{bearing\}\}/g, '');
        }
      }
      
      url = url.replace(/([^:]\/)\/+/g, '$1');
      
      return url;
    } catch (error) {
      console.error('Error building URL:', error);
      return null;
    }
  }
  
  /**
   * Prompt user to add custom service
   */
  promptAddCustomService() {
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;';
    
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background: white; padding: 24px; border-radius: 8px; min-width: 400px; max-width: 500px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
    
    dialog.innerHTML = `
      <h2 style="margin: 0 0 20px 0; font-size: 18px; color: #4F5D75;">Add Custom Service</h2>
      <form id="custom-service-form">
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #4F5D75; font-weight: 600;">Service Name</label>
          <input type="text" id="service-name" required style="width: 100%; padding: 8px 12px; border: 1px solid #919AA8; border-radius: 5px; font-size: 14px; box-sizing: border-box;" placeholder="e.g., My Custom Map">
        </div>
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #4F5D75; font-weight: 600;">URL Template</label>
          <textarea id="service-url" required style="width: 100%; padding: 8px 12px; border: 1px solid #919AA8; border-radius: 5px; font-size: 14px; box-sizing: border-box; min-height: 60px; font-family: monospace;" placeholder="https://example.com/map#{{zoom}}/{{lat}}/{{lon}}"></textarea>
          <small style="color: #919AA8; font-size: 12px;">Use {{lat}}, {{lon}}, {{zoom}} as placeholders</small>
        </div>
        <div style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #4F5D75; font-weight: 600;">Alternative URL (Optional)</label>
          <textarea id="service-alt-url" style="width: 100%; padding: 8px 12px; border: 1px solid #919AA8; border-radius: 5px; font-size: 14px; box-sizing: border-box; min-height: 60px; font-family: monospace;" placeholder="Alternative URL for Shift+click"></textarea>
          <small style="color: #919AA8; font-size: 12px;">Opens when Shift is held while clicking</small>
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button type="button" id="cancel-btn" style="padding: 8px 16px; background: #f5f5f5; border: 1px solid #919AA8; border-radius: 5px; cursor: pointer; font-size: 14px;">Cancel</button>
          <button type="submit" id="add-btn" style="padding: 8px 16px; background: #4285F4; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: 600;">Add Service</button>
        </div>
      </form>
    `;
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
    
    // Handle form submission
    const form = dialog.querySelector('#custom-service-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('service-name').value.trim();
      const url = document.getElementById('service-url').value.trim();
      const altUrl = document.getElementById('service-alt-url').value.trim();
      
      if (!name || !url) {
        alert('Please fill in all required fields.');
        return;
      }
      
      // Detect URL template
      const urlTemplate = this.detectUrlTemplate(url);
      
      if (!urlTemplate) {
        alert('Could not detect URL pattern. Please use a URL with {{lat}}, {{lon}}, {{zoom}} placeholders.');
        return;
      }
      
      let altUrlTemplate = null;
      if (altUrl) {
        altUrlTemplate = this.detectUrlTemplate(altUrl);
      }
      
      const service = {
        name: name,
        urlTemplate: urlTemplate,
        altUrlTemplate: altUrlTemplate,
        hasShiftModifier: !!altUrl
      };
      
      this.customServices.push(service);
      this.saveCustomServices();
      this.renderServices();
      UIComponents.Logger.log(`Added custom service: ${name}`, "success");
      
      document.body.removeChild(modal);
    });
    
    // Handle cancel button
    const cancelBtn = dialog.querySelector('#cancel-btn');
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }
  
  /**
   * Detect URL template from example URL
   */
  detectUrlTemplate(url) {
    // Try to detect common patterns
    const patterns = [
      // Google Maps style: /@lat,lon,zoomz
      { regex: /@([\d\.-]+),([\d\.-]+),(\d+)z/, template: url.replace(/@[\d\.-]+,[\d\.-]+,\d+z/, '@{{lat}},{{lon}},{{zoom}}z') },
      
      // OSM style: #map=zoom/lat/lon
      { regex: /#map=(\d+)\/([\d\.-]+)\/([\d\.-]+)/, template: url.replace(/#map=\d+\/[\d\.-]+\/[\d\.-]+/, '#map={{zoom}}/{{lat}}/{{lon}}') },
      
      // Bing style: cp=lat~lon&lvl=zoom
      { regex: /cp=([\d\.-]+)~([\d\.-]+)&lvl=(\d+)/, template: url.replace(/cp=[\d\.-]+~[\d\.-]+&lvl=\d+/, 'cp={{lat}}~{{lon}}&lvl={{zoom}}') },
      
      // Yandex style: ll=lon,lat&z=zoom
      { regex: /ll=([\d\.-]+),([\d\.-]+)&z=(\d+)/, template: url.replace(/ll=[\d\.-]+,[\d\.-]+&z=\d+/, 'll={{lon}},{{lat}}&z={{zoom}}') },
      
      // Generic pattern: lat=...&lng=...&z=...
      { regex: /lat=([\d\.-]+)[&?]/i, template: url.replace(/lat=[\d\.-]+/gi, 'lat={{lat}}').replace(/lng=[\d\.-]+/gi, 'lng={{lon}}').replace(/[?&]z=(\d+)/g, '&z={{zoom}}') },
      
      // Try to replace any decimal numbers in URL paths
      { regex: /(\d+\.?\d*)/, template: url.replace(/(\d+\.?\d*)/g, '{{coords}}') }
    ];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(url)) {
        // Transform the specific numbers to template
        let template = url;
        template = template.replace(/([\d\.-]+)\s*,\s*([\d\.-]+)\s*,\s*(\d+)z/g, '{{lat}},{{lon}},{{zoom}}z');
        template = template.replace(/#map=(\d+)\/([\d\.-]+)\/([\d\.-]+)/g, '#map={{zoom}}/{{lat}}/{{lon}}');
        template = template.replace(/cp=([\d\.-]+)~([\d\.-]+)&lvl=(\d+)/g, 'cp={{lat}}~{{lon}}&lvl={{zoom}}');
        template = template.replace(/ll=([\d\.-]+),([\d\.-]+)&z=(\d+)/g, 'll={{lon}},{{lat}}&z={{zoom}}');
        template = template.replace(/lat=([\d\.-]+)/gi, 'lat={{lat}}');
        template = template.replace(/lng=([\d\.-]+)/gi, 'lng={{lon}}');
        template = template.replace(/[?&]z=(\d+)/g, '&z={{zoom}}');
        
        if (template.includes('{{')) {
          return template;
        }
      }
    }
    
    // Fallback: just replace numbers with placeholders
    let template = url;
    template = template.replace(/(-?\d+\.\d+)/g, '{{lat}}');
    template = template.replace(/(-?\d+\.\d+)/g, '{{lon}}');
    template = template.replace(/\/(\d+)\//g, '/{{zoom}}/');
    
    return template;
  }
  
  /**
   * Delete custom service
   */
  deleteCustomService(name) {
    if (confirm(`Delete "${name}"?`)) {
      this.customServices = this.customServices.filter(s => s.name !== name);
      this.saveCustomServices();
      this.renderServices();
      UIComponents.Logger.log(`Deleted custom service: ${name}`, "info");
    }
  }
  
  /**
   * Load custom services from storage
   */
  loadCustomServices() {
    try {
      const saved = localStorage.getItem('coordinate_extractor_custom_services');
      if (saved) {
        this.customServices = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading custom services:', error);
      this.customServices = [];
    }
  }
  
  /**
   * Save custom services to storage
   */
  saveCustomServices() {
    try {
      localStorage.setItem('coordinate_extractor_custom_services', JSON.stringify(this.customServices));
    } catch (error) {
      console.error('Error saving custom services:', error);
    }
  }
  
  /**
   * Setup keyboard shortcuts for services (1-5)
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      // Only work when popup is open and not in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Don't handle service shortcuts if Alt/Option is pressed - let app.js handle slot selection
      if (e.altKey || e.metaKey) {
        return;
      }
      
      let keyNumber = null;
      
      // Try to get number from e.code first (more reliable)
      if (e.code && e.code.startsWith('Digit')) {
        keyNumber = e.code.replace('Digit', '');
      } else if (e.code && e.code.startsWith('Numpad')) {
        keyNumber = e.code.replace('Numpad', '');
      }
      
      // Fallback: try to get from e.key
      if (!keyNumber) {
        const key = e.key;
        
        // Check if pressing 1-9
        // Note: Shift+numbers produce special characters on some keyboards
        // Shift+1='!', Shift+2='@', Shift+3='#', Shift+4='$', Shift+5='%', etc.
        const shiftNumberMap = {
          '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
          '^': '6', '&': '7', '*': '8', '(': '9'
        };
        
        if (shiftNumberMap[key]) {
          keyNumber = shiftNumberMap[key];
        } else if (key >= '1' && key <= '9') {
          keyNumber = key;
        }
      }
      
      if (keyNumber && keyNumber >= '1' && keyNumber <= '9') {
        console.log('Processing hotkey:', keyNumber, 'e.code:', e.code, 'e.key:', e.key, 'e.shiftKey:', e.shiftKey);
        const index = parseInt(keyNumber) - 1;
        
        // Get visible services order from localStorage (same as in renderServices)
        const visibleOrder = this.getVisibleServicesOrder();
        const serviceName = visibleOrder[index];
        
        if (serviceName) {
          const service = this.standardServices.find(s => s.name === serviceName) || 
                         this.customServices.find(s => s.name === serviceName);
          
          if (service) {
            e.preventDefault();
            e.stopPropagation();
            const shiftState = this.isShiftHeld || e.shiftKey;
            await this.openService(service, shiftState);
          } else {
            console.warn('Service not found:', serviceName, 'at index:', index);
          }
        } else {
          console.warn('No service at index:', index, 'visible services:', visibleOrder.length);
        }
      }
    });
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ServiceModal;
} else {
  window.ServiceModal = ServiceModal;
}

