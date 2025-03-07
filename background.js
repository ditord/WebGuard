// background.js
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
  updateRules();
});

// Load approved sites from storage
function loadApprovedSites() {
  chrome.storage.local.get(['enabled', 'approvedSites'], (result) => {
    enabled = result.enabled;
    approvedSites = result.approvedSites || [];
    updateRules();
  });
}

// Update declarativeNetRequest rules
function updateRules() {
  if (!enabled) {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1],
      addRules: []
    });
    return;
  }

  const rules = approvedSites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: "allow" },
    condition: { urlFilter: `*://${site}/*` }
  }));

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: Array.from({ length: approvedSites.length }, (_, i) => i + 1),
    addRules: rules
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    enabled = changes.enabled.newValue;
  }
  if (changes.approvedSites) {
    approvedSites = changes.approvedSites.newValue;
  }
  updateRules();
});

// Log blocked request
function logBlockedRequest(details) {
  chrome.storage.local.get(['blockedRequests'], (result) => {
    const blockedRequests = result.blockedRequests || [];
    blockedRequests.push({
      url: details.url,
      timestamp: new Date().toISOString(),
      type: details.type
    });
    if (blockedRequests.length > 1000) {
      blockedRequests.shift();
    }
    chrome.storage.local.set({ blockedRequests });
  });
}

// Create notification for blocked request
function notifyBlockedRequest(details) {
  const hostname = new URL(details.url).hostname;
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Connection Blocked',
    message: `Connection to ${hostname} was blocked. Open WebGuard to add it to your approved sites.`,
    priority: 2
  });
}