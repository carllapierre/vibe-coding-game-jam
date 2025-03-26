/**
 * Global username storage
 */
let globalUsername = null;

/**
 * Extract and store username from URL parameters on initialization
 */
export function initializeFromUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const usernameParam = urlParams.get('username');
  
  // If username param exists, store it
  if (usernameParam) {
    globalUsername = usernameParam;
    console.log(`Username set from URL: ${globalUsername}`);
  }
}

/**
 * Get the current global username
 * @returns {string} The username or a default value
 */
export function getUsername() {
  return globalUsername || "Player";
}

/**
 * Set the global username
 * @param {string} username - The username to set
 */
export function setUsername(username) {
  globalUsername = username;
}

/**
 * Add username to a URL if it exists globally
 * @param {string} url - The URL to add the username to
 * @returns {string} The URL with username parameter if available
 */
export function addUsernameToUrl(url) {
  if (!globalUsername) return url;
  
  // Check if URL already has parameters
  const hasParams = url.includes('?');
  const separator = hasParams ? '&' : '?';
  
  return `${url}${separator}username=${encodeURIComponent(globalUsername)}`;
} 