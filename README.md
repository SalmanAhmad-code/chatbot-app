# 🤖 AI Chat & Image Generator

A modern, full-featured AI chatbot that combines intelligent conversation with image generation capabilities in a beautiful, unified interface.

## ✨ Features

- **💬 Intelligent Conversations** - Context-aware chat with memory across sessions
- **🎨 AI Image Generation** - Create stunning images using Stable Diffusion XL
- **🧠 Session Memory** - Remembers conversation history for natural dialogue
- **🎯 Smart Detection** - Automatically detects when you want to generate images
- **📱 Responsive Design** - Beautiful UI that works on desktop and mobile
- **⚡ Fast Responses** - Optimized for quick text responses and efficient image generation
- **🗑️ Clear Conversations** - Reset chat history with one click

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**
   ```bash
   git clone https://github.com/SalmanAhmad-code/chatbot-app
   cd chatbot-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   node server.js
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## 🎯 How to Use

### Text Conversations
- Type any message and press Enter or click Send
- The AI will remember your conversation history
- Ask follow-up questions and the AI will understand the context

### Image Generation
Use natural language to request images:
- "Create an image of a sunset over mountains"
- "Draw a cute cat wearing a hat"
- "Generate a futuristic cityscape"
- "Make me a picture of a robot"
- "Show me an image of space"

### Example Conversation
```
You: Hello! What can you do?
AI: I can chat with you and generate images! Ask me anything or request an image.

You: Create an image of a beautiful sunset
AI: I've generated an image for you: a beautiful sunset
[Image appears in chat]

You: Make it more colorful
AI: I've generated an image for you: a beautiful colorful sunset with vibrant colors
[New colorful image appears]
```

## 🛠️ Technology Stack

- **Backend**: Node.js + Express.js
- **AI Models**: 
  - OpenAI GPT (via Hugging Face Router) for conversations
  - Stable Diffusion XL for image generation
- **Frontend**: Vanilla JavaScript with modern CSS
- **APIs**: Hugging Face Inference API

## 📁 Project Structure

```
jacob-test-proj/
├── server.js          # Main server file with API endpoints
├── index.html         # Frontend UI
├── package.json       # Dependencies and scripts
└── README.md         # This file
```

## 🔧 Configuration

### API Keys
The project uses Hugging Face API for both chat and image generation. The API key is currently hardcoded in `server.js`. For production, consider using environment variables:

```javascript
// Replace hardcoded key with:
const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
```

### Models Used
- **Chat**: `openai/gpt-oss-20b:fireworks-ai`
- **Images**: `stabilityai/stable-diffusion-xl-base-1.0`

## 🎨 Customization

### Changing Image Parameters
Edit the image generation parameters in `server.js`:

```javascript
parameters: {
  num_inference_steps: 20,    // Quality vs speed (10-50)
  guidance_scale: 7.5,        // How closely to follow prompt (1-20)
  width: 512,                 // Image width
  height: 512                 // Image height
}
```

### Modifying AI Behavior
Update the system message in the `initializeConversation` function:

```javascript
content: "You are a helpful AI assistant that can both chat and generate images..."
```

## 🔍 API Endpoints

### POST `/chat`
Handles both text conversations and image generation requests.

**Request:**
```json
{
  "message": "Hello, can you create an image of a cat?",
  "sessionId": "optional-session-id"
}
```

**Response (Text):**
```json
{
  "reply": "Hello! How can I help you today?",
  "sessionId": "generated-session-id"
}
```

**Response (Image):**
```json
{
  "reply": "I've generated an image for you: a cute cat",
  "sessionId": "session-id",
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...",
  "imagePrompt": "a cute cat"
}
```

### POST `/generate-image`
Direct image generation endpoint (legacy, but still functional).

**Request:**
```json
{
  "prompt": "a beautiful sunset over mountains"
}
```

## 🚀 Deployment

### Local Development
```bash
node server.js
```

### Production Deployment
1. Set environment variables for API keys
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "ai-chatbot"
   ```
3. Set up reverse proxy with Nginx
4. Enable HTTPS with SSL certificates

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- [Hugging Face](https://huggingface.co/) for providing excellent AI models
- [Stable Diffusion](https://stability.ai/) for the image generation model
- [OpenAI](https://openai.com/) for the chat completion API

---

**Enjoy chatting and creating with AI! 🤖✨**
