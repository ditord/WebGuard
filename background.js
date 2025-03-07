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
});

// Load approved sites from storage
function loadApprovedSites() {
  chrome.storage.local.get(['enabled', 'approvedSites'], (result) => {
    enabled = result.enabled;
    approvedSites = result.approvedSites || [];
  });
}

// Check if URL is on approved list
function isApprovedURL(url) {
  const hostname = new URL(url).hostname;
  return approvedSites.some(site => {
    const approvedSite = site.toLowerCase();
    const requestHostname = hostname.toLowerCase();
    return requestHostname === approvedSite || requestHostname.endsWith('.' + approvedSite);
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

// Intercept and filter web requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!enabled) {
      return { cancel: false };
    }
    const url = details.url;
    if (url.startsWith('chrome-extension://')) {
      return { cancel: false };
    }
    if (isApprovedURL(url)) {
      return { cancel: false };
    } else {
      logBlockedRequest(details);
      if (details.type === 'main_frame') {
        notifyBlockedRequest(details);
      }
      return { cancel: true };
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);