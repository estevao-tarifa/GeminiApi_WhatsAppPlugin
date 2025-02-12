document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');

  // Load saved API key
  chrome.storage.sync.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
  });

  // Save API key
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (apiKey) {
      chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
        saveButton.textContent = 'Salvo!';
        setTimeout(() => {
          saveButton.textContent = 'Salvar Configurações';
        }, 2000);
      });
    } else {
      alert('Por favor, insira uma chave API válida.');
    }
  });
}); 