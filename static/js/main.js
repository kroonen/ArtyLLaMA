function chatApp() {
  return {
      chatHistory: [],
      userInput: '',
      selectedModel: '',
      availableModels: [],
      isLoading: false,
      showArtifact: false,
      artifacts: [],
      currentArtifactIndex: -1,
      isHtmlContent: false,
      showHtmlPreview: false,
      systemMessage: '',
      showSystemMessage: false,
      isArtifactExpanded: false,

      async init() {
          await this.fetchAvailableModels();
          if (this.availableModels.length > 0) {
              this.selectedModel = this.availableModels[0];
          }
          this.initResizable();
      },

      async fetchAvailableModels() {
          try {
              const response = await fetch('/available_models');
              this.availableModels = await response.json();
          } catch (error) {
              console.error('Error fetching available models:', error);
          }
      },

      async changeModel() {
          console.log(`Model changed to: ${this.selectedModel}`);
      },

      async sendMessage() {
          if (this.userInput.trim() === '') return;

          const userMessage = this.userInput;
          this.chatHistory.push({ role: 'user', content: userMessage, id: Date.now() });
          this.userInput = '';
          this.isLoading = true;
          this.showArtifact = false;

          try {
              const response = await fetch('/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                      prompt: userMessage,
                      model: this.selectedModel,
                      system_message: this.systemMessage,
                      chat_history: this.chatHistory
                  })
              });

              if (!response.ok) {
                  throw new Error('Failed to generate response');
              }

              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let aiResponse = '';

              this.chatHistory.push({ role: 'assistant', content: '', id: Date.now() + 1 });

              while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');

                  for (const line of lines) {
                      if (line.trim() === '') continue;
                      try {
                          const data = JSON.parse(line);
                          if (data.error) {
                              throw new Error(data.error);
                          }
                          if (data.token) {
                              aiResponse += data.token;
                              this.chatHistory[this.chatHistory.length - 1].content = aiResponse;
                          }
                          if (data.type === 'artifact') {
                              this.addArtifact(data.data);
                          }
                      } catch (parseError) {
                          console.error('Error parsing JSON:', parseError);
                      }
                  }
              }
          } catch (error) {
              console.error('Error:', error);
              this.chatHistory.push({ role: 'assistant', content: 'An error occurred while generating the response.', id: Date.now() + 2 });
          } finally {
              this.isLoading = false;
          }

          this.$nextTick(() => {
              this.scrollChatToBottom();
          });
      },

      addArtifact(data) {
          const artifact = {
              filename: data.filename,
              content: data.content,
              isHtml: this.detectHtmlContent(data.content),
              showPreview: false
          };
          this.artifacts.push(artifact);
          this.currentArtifactIndex = this.artifacts.length - 1;
          this.showArtifact = true;this.displayCurrentArtifact();

          // Add artifact to chat history
          this.chatHistory.push({
              role: 'artifact',
              content: artifact.filename,
              id: Date.now() + 3,
              artifactIndex: this.currentArtifactIndex
          });
      },

      displayCurrentArtifact() {
          if (this.currentArtifactIndex < 0) return;
          const artifact = this.artifacts[this.currentArtifactIndex];
          const artifactContainer = document.getElementById('artifact-display');
          artifactContainer.innerHTML = `<pre><code>${this.escapeHtml(artifact.content)}</code></pre>`;
          this.isHtmlContent = artifact.isHtml;
          this.showHtmlPreview = false;
      },

      nextArtifact() {
          if (this.currentArtifactIndex < this.artifacts.length - 1) {
              this.currentArtifactIndex++;
              this.displayCurrentArtifact();
          }
      },

      previousArtifact() {
          if (this.currentArtifactIndex > 0) {
              this.currentArtifactIndex--;
              this.displayCurrentArtifact();
          }
      },

      detectHtmlContent(content) {
          return /<\s*html|<\s*body|<.*>/.test(content.trim());
      },

      toggleHtmlPreview() {
          if (this.currentArtifactIndex < 0) return;
          const artifact = this.artifacts[this.currentArtifactIndex];
          this.showHtmlPreview = !this.showHtmlPreview;

          if (this.showHtmlPreview) {
              const previewContainer = document.getElementById('html-preview');
              previewContainer.innerHTML = artifact.content;
          }
      },

      minimizeArtifact() {
          this.showArtifact = false;
          this.isArtifactExpanded = false;
      },

      copyArtifact() {
          if (this.currentArtifactIndex < 0) return;
          const artifact = this.artifacts[this.currentArtifactIndex];
          navigator.clipboard.writeText(artifact.content).then(() => {
              alert('Code copied to clipboard!');
          }, (err) => {
              console.error('Could not copy text: ', err);
          });
      },

      escapeHtml(unsafe) {
          return unsafe
               .replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
      },

      scrollChatToBottom() {
          const chatHistory = document.getElementById('chat-history');
          chatHistory.scrollTop = chatHistory.scrollHeight;
      },

      toggleArtifactExpansion() {
          this.isArtifactExpanded = !this.isArtifactExpanded;
          const panel = document.getElementById('artifact-panel');
          panel.classList.toggle('expanded', this.isArtifactExpanded);
      },

      initResizable() {
          const panel = document.getElementById('artifact-panel');
          const handle = document.createElement('div');
          handle.className = 'resizable-handle';
          panel.appendChild(handle);

          let isResizing = false;
          let startX, startWidth;

          handle.addEventListener('mousedown', (e) => {
              isResizing = true;
              startX = e.clientX;
              startWidth = parseInt(window.getComputedStyle(panel).width, 10);
          });

          document.addEventListener('mousemove', (e) => {
              if (!isResizing) return;
              const width = startWidth - (e.clientX - startX);
              panel.style.width = `${Math.max(300, Math.min(width, window.innerWidth * 0.8))}px`;
          });

          document.addEventListener('mouseup', () => {
              isResizing = false;
          });
      },

      openArtifact(index) {
          this.currentArtifactIndex = index;
          this.showArtifact = true;
          this.displayCurrentArtifact();
      }
  };
}

// Initialize Alpine.js
document.addEventListener('alpine:init', () => {
  Alpine.data('chatApp', chatApp);
});
