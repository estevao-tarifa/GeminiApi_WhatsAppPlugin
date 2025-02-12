// Determine which platform we're on
function getPlatform() {
  const url = window.location.href;
  if (url.includes('web.whatsapp.com')) return 'whatsapp';
  if (url.includes('app.delos.vip')) return 'delos';
  return null;
}

// Create and inject the floating button
function createFloatingButton() {
  const button = document.createElement('button');
  button.className = 'wa-text-enhancer-btn';
  button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
  
  // Adjust position based on platform
  const platform = getPlatform();
  if (platform === 'delos') {
    button.style.right = '80px';  // Adjust if needed
    button.style.top = '80%';     // Position lower for Delos
  }
  
  document.body.appendChild(button);
  return button;
}

// Create and inject the popup interface
function createPopup() {
  const popup = document.createElement('div');
  popup.className = 'wa-text-enhancer-popup';
  
  // Adjust position based on platform
  const platform = getPlatform();
  if (platform === 'delos') {
    popup.style.right = '150px';  // Adjust if needed
    popup.style.top = '80%';      // Position lower for Delos
  }
  
  popup.innerHTML = `
    <div class="wa-text-enhancer-options">
      <label class="wa-text-enhancer-checkbox">
        <input type="checkbox" id="correctSpelling" checked>
        Corrigir Ortografia
      </label>
      <label class="wa-text-enhancer-checkbox">
        <input type="checkbox" id="improveWriting" checked>
        Melhorar Escrita
      </label>
    </div>
    <textarea class="wa-text-enhancer-textarea" placeholder="Digite ou cole seu texto aqui..."></textarea>
    <button class="wa-text-enhancer-button">Melhorar Texto</button>
    <div class="wa-text-enhancer-result" style="display: none;">
      <p class="result-text"></p>
      <button class="wa-text-enhancer-copy">Copiar</button>
    </div>
  `;
  document.body.appendChild(popup);
  return popup;
}

// Handle Gemini API calls
async function improveText(text, options) {
  try {
    const apiKey = await new Promise((resolve) => {
      chrome.storage.sync.get(['geminiApiKey'], (result) => {
        resolve(result.geminiApiKey);
      });
    });

    if (!apiKey) {
      throw new Error('Chave API não encontrada. Por favor, configure nas configurações da extensão.');
    }

    const platform = getPlatform();
    let prompt = 'Tu é meu assistente de digitação. ';
    
    // Customize prompt based on platform
    if (platform === 'delos') {
      prompt += 'Ajuste o texto para um tom profissional e adequado para atendimento ao cliente. ';
    } else {
      prompt += 'Ajuste o texto para um tom adequado para mensagens do WhatsApp (sem formalidades excessivas). ';
    }

    if (options.correctSpelling && options.improveWriting) {
      prompt += 'Quero que corrija a ortografia E melhore o tom profissional desta mensagem: ';
    } else if (options.correctSpelling) {
      prompt += 'Quero que apenas corrija a ortografia desta mensagem: ';
    } else if (options.improveWriting) {
      prompt += 'Quero que apenas melhore o tom profissional desta mensagem: ';
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt + text
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      let errorMessage = 'Erro desconhecido na API do Gemini';
      
      if (errorData?.error) {
        if (errorData.error.code === 403) {
          errorMessage = 'Chave API inválida ou sem permissões necessárias. Por favor, verifique sua chave API.';
        } else if (errorData.error.code === 429) {
          errorMessage = 'Limite de requisições excedido. Por favor, aguarde um momento e tente novamente.';
        } else {
          errorMessage = errorData.error.message || errorData.error.status;
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Resposta inválida da API do Gemini');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Erro na chamada da API:', error);
    throw new Error(`Erro ao processar texto: ${error.message}`);
  }
}

// Initialize the extension
function init() {
  // Only initialize if we're on a supported platform
  const platform = getPlatform();
  if (!platform) return;

  const button = createFloatingButton();
  const popup = createPopup();
  
  button.addEventListener('click', () => {
    popup.classList.toggle('active');
  });

  const improveButton = popup.querySelector('.wa-text-enhancer-button');
  const textarea = popup.querySelector('.wa-text-enhancer-textarea');
  const resultDiv = popup.querySelector('.wa-text-enhancer-result');
  const resultText = popup.querySelector('.result-text');
  const copyButton = popup.querySelector('.wa-text-enhancer-copy');
  const spellCheckBox = popup.querySelector('#correctSpelling');
  const improveWritingBox = popup.querySelector('#improveWriting');

  improveButton.addEventListener('click', async () => {
    const text = textarea.value;
    if (!text) return;

    try {
      improveButton.disabled = true;
      improveButton.textContent = 'Processando...';

      const improvedText = await improveText(text, {
        correctSpelling: spellCheckBox.checked,
        improveWriting: improveWritingBox.checked
      });

      resultText.textContent = improvedText;
      resultDiv.style.display = 'block';
    } catch (error) {
      alert(error.message);
    } finally {
      improveButton.disabled = false;
      improveButton.textContent = 'Melhorar Texto';
    }
  });

  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(resultText.textContent);
    copyButton.textContent = 'Copiado!';
    setTimeout(() => {
      copyButton.textContent = 'Copiar';
    }, 2000);
  });
}

// Start the extension when the page is loaded
if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
} 