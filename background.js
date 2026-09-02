/**
 * VoxMark AI - Background Service Worker (Manifest V3)
 * Handles context menu registration, lifecycle events, and content script injection.
 */

const CONTEXT_MENU_ID = "voxmark-read";

// Set up context menu on install / update
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "🔊 Read Aloud with AI Voice",
      contexts: ["selection"]
    });
  });
});

/**
 * Checks if a tab's URL is restricted from content script execution.
 * @param {string} url
 * @returns {boolean}
 */
function isRestrictedUrl(url) {
  if (!url) return true;
  const restrictedProtocols = ["chrome:", "chrome-extension:", "edge:", "about:", "devtools:", "view-source:"];
  const restrictedHosts = ["chrome.google.com", "chromewebstore.google.com"];

  try {
    const parsed = new URL(url);
    if (restrictedProtocols.includes(parsed.protocol)) return true;
    if (restrictedHosts.includes(parsed.hostname)) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Injects content scripts dynamically into an existing tab if not already loaded.
 * @param {number} tabId
 */
async function ensureContentScriptInjected(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["content.css"]
    }).catch(() => {});

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (err) {
    console.warn("[VoxMark AI] Failed to dynamically inject content script:", err);
    throw err;
  }
}

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const rawText = info.selectionText ? info.selectionText.trim() : "";
  if (!rawText) return;

  if (!tab || !tab.id) {
    console.error("[VoxMark AI] No active tab found.");
    return;
  }

  // Handle restricted pages (chrome://, Web Store, etc.)
  if (isRestrictedUrl(tab.url)) {
    console.warn(`[VoxMark AI] Cannot run on restricted URL: ${tab.url}`);
    chrome.action.setBadgeText({ tabId: tab.id, text: "!" });
    chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#EF4444" });
    setTimeout(() => {
      chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    }, 3000);
    return;
  }

  // Attempt sending message to content script
  const payload = {
    action: "READ_SELECTION",
    text: rawText
  };

  try {
    await chrome.tabs.sendMessage(tab.id, payload);
  } catch (err) {
    // Content script may not be loaded yet in this tab; dynamically inject and retry
    try {
      await ensureContentScriptInjected(tab.id);
      // Brief pause to allow listeners inside content.js to initialize
      await new Promise(resolve => setTimeout(resolve, 80));
      await chrome.tabs.sendMessage(tab.id, payload);
    } catch (injectionErr) {
      console.error("[VoxMark AI] Error communicating with tab after injection:", injectionErr);
    }
  }
});
