import express from "express";
import { OpenAI } from "openai";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_API_KEY,
});

// Store conversation history for each session
const conversationHistory = new Map();

// Generate a simple session ID for demo purposes
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15);
}

// Initialize conversation history for a session
function initializeConversation(sessionId) {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, [
      {
        role: "system",
        content: "You are a helpful AI assistant that can both chat and generate images. When a user asks you to create, generate, draw, make, or show an image/picture/photo, respond with 'GENERATE_IMAGE:' followed by a detailed prompt for the image. For example: 'GENERATE_IMAGE: a beautiful sunset over mountains, digital art style'. When a user asks to modify, enhance, or change a previously generated image (like 'make it more colorful', 'add more details', 'change the style', etc.), also respond with 'GENERATE_IMAGE:' followed by an enhanced version of the previous image prompt that incorporates their requested changes. For all other requests, respond normally as a helpful assistant. Keep responses concise and friendly."
      }
    ]);
  }
  return conversationHistory.get(sessionId);
}

// Clean up old conversations (keep last 10 messages per session)
function cleanupConversation(messages) {
  // Keep system message + last 9 messages (to stay within token limits)
  if (messages.length > 10) {
    const systemMessage = messages[0];
    const recentMessages = messages.slice(-9);
    return [systemMessage, ...recentMessages];
  }
  return messages;
}

// Extract the last image prompt from conversation history
function getLastImagePrompt(messages) {
  // Look through messages from newest to oldest to find the last image generation
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "assistant" && message.content.includes("I've generated an image for you:")) {
      // Extract the prompt from the message
      const match = message.content.match(/I've generated an image for you: (.+)/);
      if (match) {
        return match[1];
      }
    }
  }
  return null;
}

// Enhance prompt with user's modification request
function enhanceImagePrompt(originalPrompt, userModification, userMessage) {
  if (!originalPrompt) {
    // If no previous prompt found, create a new one based on user's request
    return userMessage;
  }
  
  // Common modification patterns
  const modifications = {
    'colorful': 'vibrant colors, rainbow colors, bright and saturated',
    'more colorful': 'vibrant colors, rainbow colors, bright and saturated',
    'darker': 'dark atmosphere, moody lighting, shadows',
    'brighter': 'bright lighting, sunny, illuminated',
    'realistic': 'photorealistic, high detail, professional photography',
    'artistic': 'artistic style, creative, digital art',
    'cartoon': 'cartoon style, animated, colorful illustration',
    'detailed': 'highly detailed, intricate details, fine details'
  };
  
  let enhancement = '';
  const lowerMessage = userModification.toLowerCase();
  
  // Find matching modifications
  for (const [key, value] of Object.entries(modifications)) {
    if (lowerMessage.includes(key)) {
      enhancement += ', ' + value;
    }
  }
  
  // If no specific enhancement found, append the user's request directly
  if (!enhancement) {
    enhancement = ', ' + userModification;
  }
  
  return originalPrompt + enhancement;
}

// Chatbot endpoint
app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  // Use provided sessionId or generate a new one
  const currentSessionId = sessionId || generateSessionId();
  
  // Get or initialize conversation history for this session
  const messages = initializeConversation(currentSessionId);
  
  // Check if this might be an image modification request
  const isLikelyImageModification = /\b(make it|change|modify|more|less|add|remove|different|style|color|bright|dark|realistic|cartoon|artistic)\b/i.test(message) && 
                                   !/\b(create|generate|draw|make me|show me|image of|picture of)\b/i.test(message);
  
  // Add user message to conversation history
  messages.push({
    role: "user",
    content: message
  });

  try {
    const chatCompletion = await client.chat.completions.create({
      model: "openai/gpt-oss-20b:fireworks-ai",
      messages: cleanupConversation(messages),
      max_tokens: 150,
      temperature: 0.7
    });

    const assistantResponse = chatCompletion.choices[0].message.content || "No response";
    
    // Check if the assistant wants to generate an image
    if (assistantResponse.startsWith('GENERATE_IMAGE:')) {
      let imagePrompt = assistantResponse.replace('GENERATE_IMAGE:', '').trim();
      
      // If this seems like a modification request and we have a previous image, enhance the prompt
      if (isLikelyImageModification) {
        const lastPrompt = getLastImagePrompt(messages);
        if (lastPrompt) {
          imagePrompt = enhanceImagePrompt(lastPrompt, message, imagePrompt);
        }
      }
      
      try {
        // Generate the image
        const imageResponse = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
          method: "POST",
          headers: {
            "Authorization": `Bearer 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`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: imagePrompt,
            parameters: {
              num_inference_steps: 20,
              guidance_scale: 7.5,
              width: 512,
              height: 512
            }
          }),
        });

        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          
          // Add assistant response to conversation history
          messages.push({
            role: "assistant",
            content: `I've generated an image for you: ${imagePrompt}`
          });

          res.json({ 
            reply: `I've generated an image for you: ${imagePrompt}`,
            sessionId: currentSessionId,
            image: `data:image/png;base64,${base64Image}`,
            imagePrompt: imagePrompt
          });
        } else {
          // Fallback if image generation fails
          const fallbackMessage = "I'd love to generate that image for you, but I'm having trouble with the image service right now. Please try again later.";
          messages.push({
            role: "assistant",
            content: fallbackMessage
          });

          res.json({ 
            reply: fallbackMessage,
            sessionId: currentSessionId 
          });
        }
      } catch (imageError) {
        console.error("Image generation error:", imageError);
        const fallbackMessage = "I'd love to generate that image for you, but I'm having trouble with the image service right now. Please try again later.";
        messages.push({
          role: "assistant",
          content: fallbackMessage
        });

        res.json({ 
          reply: fallbackMessage,
          sessionId: currentSessionId 
        });
      }
    } else {
      // For image modification requests that the AI didn't catch, handle them manually
      if (isLikelyImageModification) {
        const lastPrompt = getLastImagePrompt(messages);
        if (lastPrompt) {
          const enhancedPrompt = enhanceImagePrompt(lastPrompt, message, message);
          
          try {
            const imageResponse = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
              method: "POST",
              headers: {
                "Authorization": `Bearer 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`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                inputs: enhancedPrompt,
                parameters: {
                  num_inference_steps: 20,
                  guidance_scale: 7.5,
                  width: 512,
                  height: 512
                }
              }),
            });

            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              const base64Image = Buffer.from(imageBuffer).toString('base64');
              
              // Add assistant response to conversation history
              messages.push({
                role: "assistant",
                content: `I've generated an image for you: ${enhancedPrompt}`
              });

              res.json({ 
                reply: `I've generated an image for you: ${enhancedPrompt}`,
                sessionId: currentSessionId,
                image: `data:image/png;base64,${base64Image}`,
                imagePrompt: enhancedPrompt
              });
              return;
            }
          } catch (imageError) {
            console.error("Image modification error:", imageError);
          }
        }
      }
      
      // Regular text response
      // Add assistant response to conversation history
      messages.push({
        role: "assistant",
        content: assistantResponse
      });

      res.json({ 
        reply: assistantResponse,
        sessionId: currentSessionId 
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Image generation endpoint
app.post("/generate-image", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  try {
    const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
      method: "POST",
      headers: {
        "Authorization": `Bearer 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`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          num_inference_steps: 20,
          guidance_scale: 7.5,
          width: 512,
          height: 512
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    
    res.json({ 
      image: `data:image/png;base64,${base64Image}`,
      prompt: prompt 
    });
  } catch (err) {
    console.error("Image generation error:", err);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
