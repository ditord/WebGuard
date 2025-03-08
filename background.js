// Updated background.js for Manifest V3
let enabled = true;
let approvedSites = [];

// Initialize extension data
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    enabled: true,
    approvedSites: [
      "google.com",
      "github.com",
      "stackoverflow.com"
    ],
    blockedRequests: []
  });
  
  loadApprovedSites();
});

// Load approved sites from storage
function loadApprovedSites() {
  chrome.storage.local.get(['enabled', 'approvedSites'], (result) => {
    enabled = result.enabled !== false;
    approvedSites = result.approvedSites || [];
  });
}

// Check if URL is on approved list
function isApprovedURL(url) {
  try {
    const hostname = new URL(url).hostname;
    
    return approvedSites.some(site => {
      // Convert to lowercase for case-insensitive comparison
      const approvedSite = site.toLowerCase();
      const requestHostname = hostname.toLowerCase();
      
      // Check if hostname matches or is a subdomain of approved site
      return requestHostname === approvedSite || 
             requestHostname.endsWith('.' + approvedSite);
    });
  } catch (e) {
    console.error("Error checking URL:", e);
    return true; // Allow in case of error
  }
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    enabled = changes.enabled.newValue;
  }
  if (changes.approvedSites) {
    approvedSites = changes.approvedSites.newValue;
  }
});

// Log blocked request
function logBlockedRequest(details) {
  chrome.storage.local.get(['blockedRequests'], (result) => {
    const blockedRequests = result.blockedRequests || [];
    
    blockedRequests.push({
      url: details.url,
      timestamp: new Date().toISOString(),
      type: details.type || "navigation"
    });
    
    // Limit log size (keep last 1000 entries)
    if (blockedRequests.length > 1000) {
      blockedRequests.shift();
    }
    
    chrome.storage.local.set({ blockedRequests });
  });
}

// Use tabs.onUpdated to check navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only check when URL changes and has loaded
  if (changeInfo.status === 'loading' && changeInfo.url) {
    if (!enabled) return;
    
    // Skip blocking chrome:// URLs and extension pages
    if (changeInfo.url.startsWith('chrome://') || 
        changeInfo.url.startsWith('chrome-extension://')) {
      return;
    }
    
    // Check if URL is approved
    if (!isApprovedURL(changeInfo.url)) {
      // Log the blocked request
      logBlockedRequest({
        url: changeInfo.url,
        type: "navigation",
        tabId: tabId
      });
      
      // Create a notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Connection Blocked',
        message: `Connection to ${new URL(changeInfo.url).hostname} was blocked.`,
        priority: 2
      });
      
      // Redirect to a safe page
      chrome.tabs.update(tabId, { url: 'chrome://newtab' });
    }
  }
});