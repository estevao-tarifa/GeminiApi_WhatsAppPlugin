// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('WhatsApp Text Enhancer installed successfully');
});

// Handle any errors
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'error') {
    console.error('Extension error:', request.message);
  }
}); 