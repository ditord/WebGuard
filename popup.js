// popup.js
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const toggleEnabled = document.getElementById('toggle-enabled');
    const newSiteInput = document.getElementById('new-site');
    const addSiteButton = document.getElementById('add-site');
    const addCurrentButton = document.getElementById('add-current');
    const importExportButton = document.getElementById('import-export');
    const siteList = document.getElementById('site-list');
    const requestList = document.getElementById('request-list');
    const clearLogsButton = document.getElementById('clear-logs');
    const showNotificationsCheckbox = document.getElementById('show-notifications');
    const protectionModeSelect = document.getElementById('protection-mode');
    const resetDefaultsButton = document.getElementById('reset-defaults');
    
    // Modal elements
    const importExportModal = document.getElementById('import-export-modal');
    const closeModalButton = document.querySelector('.close');
    const exportDataTextarea = document.getElementById('export-data');
    const importDataTextarea = document.getElementById('import-data');
    const copyDataButton = document.getElementById('copy-data');
    const importButton = document.getElementById('import-button');
    
    // Tab handling
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // Update active tab button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Show selected tab content
        tabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === tabName) {
            content.classList.add('active');
          }
        });
        
        // Refresh content when switching tabs
        if (tabName === 'approved-sites') {
          loadApprovedSites();
        } else if (tabName === 'blocked-requests') {
          loadBlockedRequests();
        }
      });
    });
    
    // Modal tab handling
    const modalTabButtons = document.querySelectorAll('.modal-tab-button');
    const modalTabContents = document.querySelectorAll('.modal-tab-content');
    
    modalTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // Update active tab button
        modalTabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Show selected tab content
        modalTabContents.forEach(content => {
          content.classList.remove('active');
          if (content.id === tabName) {
            content.classList.add('active');
          }
        });
        
        // Prepare export data when switching to export tab
        if (tabName === 'export') {
          prepareExportData();
        }
      });
    });
    
    // Toggle extension enabled state
    toggleEnabled.addEventListener('change', () => {
      chrome.storage.local.set({ enabled: toggleEnabled.checked });
    });
    
    // Add new site
    addSiteButton.addEventListener('click', () => {
      addSite();
    });
    
    newSiteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addSite();
      }
    });
    
    // Add current site
    addCurrentButton.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          const url = new URL(tabs[0].url);
          const hostname = url.hostname;
          
          // Extract base domain (e.g., example.com from www.example.com)
          const domainParts = hostname.split('.');
          let domain;
          
          if (domainParts.length > 2) {
            domain = domainParts.slice(domainParts.length - 2).join('.');
          } else {
            domain = hostname;
          }
          
          // Add to approved sites
          addSiteToList(domain);
        }
      });
    });
    
    // Modal handling
    importExportButton.addEventListener('click', () => {
      importExportModal.style.display = 'block';
      prepareExportData();
    });
    
    closeModalButton.addEventListener('click', () => {
      importExportModal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
      if (event.target === importExportModal) {
        importExportModal.style.display = 'none';
      }
    });
    
    // Copy export data
    copyDataButton.addEventListener('click', () => {
      exportDataTextarea.select();
      document.execCommand('copy');
      
      // Show copied confirmation
      const originalText = copyDataButton.textContent;
      copyDataButton.textContent = 'Copied!';
      setTimeout(() => {
        copyDataButton.textContent = originalText;
      }, 1500);
    });
    
    // Import data
    importButton.addEventListener('click', () => {
      const importData = importDataTextarea.value.trim();
      if (!importData) {
        return;
      }
      
      // Parse sites from textarea (one per line)
      const sites = importData.split('\n')
        .map(site => site.trim())
        .filter(site => site.length > 0);
      
      const importMode = document.querySelector('input[name="import-mode"]:checked').value;
      
      if (importMode === 'replace') {
        // Replace existing list
        chrome.storage.local.set({ approvedSites: sites }, () => {
          loadApprovedSites();
          importExportModal.style.display = 'none';
        });
      } else {
        // Merge with existing list
        chrome.storage.local.get(['approvedSites'], (result) => {
          const existingSites = result.approvedSites || [];
          
          // Combine lists and remove duplicates
          const combinedSites = [...new Set([...existingSites, ...sites])];
          
          chrome.storage.local.set({ approvedSites: combinedSites }, () => {
            loadApprovedSites();
            importExportModal.style.display = 'none';
          });
        });
      }
    });
    
    // Clear logs
    clearLogsButton.addEventListener('click', () => {
      chrome.storage.local.set({ blockedRequests: [] }, () => {
        loadBlockedRequests();
      });
    });
    
    // Notification settings
    showNotificationsCheckbox.addEventListener('change', () => {
      chrome.storage.local.set({ showNotifications: showNotificationsCheckbox.checked });
    });
    
    // Protection mode
    protectionModeSelect.addEventListener('change', () => {
      chrome.storage.local.set({ protectionMode: protectionModeSelect.value });
    });
    
    // Reset to defaults
    resetDefaultsButton.addEventListener('click', () => {
      if (confirm('This will reset all settings to default values. Continue?')) {
        chrome.storage.local.set({
          enabled: true,
          approvedSites: ['google.com', 'github.com', 'stackoverflow.com'],
          blockedRequests: [],
          showNotifications: true,
          protectionMode: 'strict'
        }, () => {
          loadSettings();
          loadApprovedSites();
        });
      }
    });
    
    // Functions
    
    // Add site to approved list
    function addSite() {
      const siteName = newSiteInput.value.trim();
      
      if (siteName) {
        addSiteToList(siteName);
        newSiteInput.value = '';
      }
    }
    
    function addSiteToList(siteName) {
      // Basic validation - ensure site has at least one dot
      if (!siteName.includes('.')) {
        alert('Please enter a valid domain (e.g., example.com)');
        return;
      }
      
      // Remove any protocol and path
      let cleanedSite = siteName;
      if (cleanedSite.includes('://')) {
        cleanedSite = cleanedSite.split('://')[1];
      }
      if (cleanedSite.includes('/')) {
        cleanedSite = cleanedSite.split('/')[0];
      }
      
      chrome.storage.local.get(['approvedSites'], (result) => {
        const approvedSites = result.approvedSites || [];
        
        // Check if site already exists
        if (approvedSites.includes(cleanedSite)) {
          alert(`${cleanedSite} is already on the approved list.`);
          return;
        }
        
        // Add site to list
        approvedSites.push(cleanedSite);
        
        // Sort alphabetically
        approvedSites.sort();
        
        chrome.storage.local.set({ approvedSites }, () => {
          loadApprovedSites();
        });
      });
    }
    
    // Remove site from approved list
    function removeSite(siteName) {
      chrome.storage.local.get(['approvedSites'], (result) => {
        const approvedSites = result.approvedSites || [];
        
        const index = approvedSites.indexOf(siteName);
        if (index !== -1) {
          approvedSites.splice(index, 1);
          
          chrome.storage.local.set({ approvedSites }, () => {
            loadApprovedSites();
          });
        }
      });
    }
    
    // Load approved sites
    function loadApprovedSites() {
      chrome.storage.local.get(['approvedSites'], (result) => {
        const approvedSites = result.approvedSites || [];
        
        siteList.innerHTML = '';
        
        if (approvedSites.length === 0) {
          siteList.innerHTML = '<div class="empty-message">No approved sites. Add some using the form above.</div>';
          return;
        }
        
        approvedSites.forEach(site => {
          const listItem = document.createElement('div');
          listItem.className = 'list-item';
          
          const siteName = document.createElement('span');
          siteName.textContent = site;
          
          const removeButton = document.createElement('button');
          removeButton.className = 'remove-btn';
          removeButton.textContent = 'Remove';
          removeButton.addEventListener('click', () => {
            removeSite(site);
          });
          
          listItem.appendChild(siteName);
          listItem.appendChild(removeButton);
          siteList.appendChild(listItem);
        });
      });
    }
    
    // Load blocked requests
    function loadBlockedRequests() {
      chrome.storage.local.get(['blockedRequests'], (result) => {
        const blockedRequests = result.blockedRequests || [];
        
        requestList.innerHTML = '';
        
        if (blockedRequests.length === 0) {
          requestList.innerHTML = '<div class="empty-message">No blocked requests logged yet.</div>';
          return;
        }
        
        // Show most recent first
        blockedRequests.reverse().forEach(request => {
          const requestItem = document.createElement('div');
          requestItem.className = 'request-item';
          
          const url = new URL(request.url);
          
          const urlElement = document.createElement('div');
          urlElement.className = 'request-url';
          urlElement.textContent = url.hostname;
          
          const infoElement = document.createElement('div');
          infoElement.className = 'request-info';
          
          const date = new Date(request.timestamp);
          infoElement.textContent = `${date.toLocaleString()} - ${request.type}`;
          
          const approveButton = document.createElement('button');
          approveButton.className = 'request-approve';
          approveButton.textContent = 'Add to Approved';
          approveButton.addEventListener('click', () => {
            addSiteToList(url.hostname);
          });
          
          requestItem.appendChild(urlElement);
          requestItem.appendChild(infoElement);
          requestItem.appendChild(approveButton);
          requestList.appendChild(requestItem);
        });
      });
    }
    
    // Prepare export data
    function prepareExportData() {
      chrome.storage.local.get(['approvedSites'], (result) => {
        const approvedSites = result.approvedSites || [];
        exportDataTextarea.value = approvedSites.join('\n');
      });
    }
    
    // Load extension settings
    function loadSettings() {
      chrome.storage.local.get(['enabled', 'showNotifications', 'protectionMode'], (result) => {
        toggleEnabled.checked = result.enabled !== false;
        showNotificationsCheckbox.checked = result.showNotifications !== false;
        
        if (result.protectionMode) {
          protectionModeSelect.value = result.protectionMode;
        }
      });
    }
    
    // Initial loading
    loadSettings();
    loadApprovedSites();
  });