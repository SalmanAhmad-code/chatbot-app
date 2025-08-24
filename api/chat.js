import { OpenAI } from "openai";
import fetch from "node-fetch";

const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_API_KEY,
});

// Store conversation history for each session (in-memory, resets on cold start)
const conversationHistory = new Map();

function generateSessionId() {
  return Math.random().toString(36).substring(2, 15);
}

function initializeConversation(sessionId) {
  if (!conversationHistory.has(sessionId)) {
    conversationHistory.set(sessionId, [
      {
        role: "system",
        content:
          "You are a helpful AI assistant that can both chat and generate images. When a user asks you to create, generate, draw, make, or show an image/picture/photo, respond with 'GENERATE_IMAGE:' followed by a detailed prompt for the image. For example: 'GENERATE_IMAGE: a beautiful sunset over mountains, digital art style'. When a user asks to modify, enhance, or change a previously generated image (like 'make it more colorful', 'add more details', 'change the style', etc.), also respond with 'GENERATE_IMAGE:' followed by an enhanced version of the previous image prompt that incorporates their requested changes. For all other requests, respond normally as a helpful assistant. Keep responses concise and friendly.",
      },
    ]);
  }
  return conversationHistory.get(sessionId);
}

function cleanupConversation(messages) {
  if (messages.length > 10) {
    const systemMessage = messages[0];
    const recentMessages = messages.slice(-9);
    return [systemMessage, ...recentMessages];
  }
  return messages;
}

function getLastImagePrompt(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message.role === "assistant" &&
      message.content.includes("I've generated an image for you:")
    ) {
      const match = message.content.match(/I've generated an image for you: (.+)/);
      if (match) {
        return match[1];
      }
    }
  }
  return null;
}

function enhanceImagePrompt(originalPrompt, userModification, userMessage) {
  if (!originalPrompt) {
    return userMessage;
  }
  const modifications = {
    colorful: "vibrant colors, rainbow colors, bright and saturated",
    "more colorful": "vibrant colors, rainbow colors, bright and saturated",
    darker: "dark atmosphere, moody lighting, shadows",
    brighter: "bright lighting, sunny, illuminated",
    realistic: "photorealistic, high detail, professional photography",
    artistic: "artistic style, creative, digital art",
    cartoon: "cartoon style, animated, colorful illustration",
    detailed: "highly detailed, intricate details, fine details",
  };
  let enhancement = "";
  const lowerMessage = userModification.toLowerCase();
  for (const [key, value] of Object.entries(modifications)) {
    if (lowerMessage.includes(key)) {
      enhancement += ", " + value;
    }
  }
  if (!enhancement) {
    enhancement = ", " + userModification;
  }
  return originalPrompt + enhancement;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { message, sessionId } = req.body;
  const currentSessionId = sessionId || generateSessionId();
  const messages = initializeConversation(currentSessionId);
  const isLikelyImageModification =
    /\b(make it|change|modify|more|less|add|remove|different|style|color|bright|dark|realistic|cartoon|artistic)\b/i.test(message) &&
    !/\b(create|generate|draw|make me|show me|image of|picture of)\b/i.test(message);
  messages.push({
    role: "user",
    content: message,
  });
  try {
    const chatCompletion = await client.chat.completions.create({
      model: "openai/gpt-oss-20b:fireworks-ai",
      messages: cleanupConversation(messages),
      max_tokens: 150,
      temperature: 0.7,
    });
    const assistantResponse = chatCompletion.choices[0].message.content || "No response";
    if (assistantResponse.startsWith("GENERATE_IMAGE:")) {
      let imagePrompt = assistantResponse.replace("GENERATE_IMAGE:", "").trim();
      if (isLikelyImageModification) {
        const lastPrompt = getLastImagePrompt(messages);
        if (lastPrompt) {
          imagePrompt = enhanceImagePrompt(lastPrompt, message, imagePrompt);
        }
      }
      try {
        const imageResponse = await fetch(
          "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer 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`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              inputs: imagePrompt,
              parameters: {
                num_inference_steps: 20,
                guidance_scale: 7.5,
                width: 512,
                height: 512,
              },
            }),
          }
        );
        if (imageResponse.ok) {
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString("base64");
          messages.push({
            role: "assistant",
            content: `I've generated an image for you: ${imagePrompt}`,
          });
          res.status(200).json({
            reply: `I've generated an image for you: ${imagePrompt}`,
            sessionId: currentSessionId,
            image: `data:image/png;base64,${base64Image}`,
            imagePrompt: imagePrompt,
          });
          return;
        } else {
          const fallbackMessage =
            "I'd love to generate that image for you, but I'm having trouble with the image service right now. Please try again later.";
          messages.push({
            role: "assistant",
            content: fallbackMessage,
          });
          res.status(200).json({ reply: fallbackMessage, sessionId: currentSessionId });
          return;
        }
      } catch (imageError) {
        const fallbackMessage =
          "I'd love to generate that image for you, but I'm having trouble with the image service right now. Please try again later.";
        messages.push({ role: "assistant", content: fallbackMessage });
        res.status(200).json({ reply: fallbackMessage, sessionId: currentSessionId });
        return;
      }
    } else {
      if (isLikelyImageModification) {
        const lastPrompt = getLastImagePrompt(messages);
        if (lastPrompt) {
          const enhancedPrompt = enhanceImagePrompt(lastPrompt, message, message);
          try {
            const imageResponse = await fetch(
              "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer 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`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  inputs: enhancedPrompt,
                  parameters: {
                    num_inference_steps: 20,
                    guidance_scale: 7.5,
                    width: 512,
                    height: 512,
                  },
                }),
              }
            );
            if (imageResponse.ok) {
              const imageBuffer = await imageResponse.arrayBuffer();
              const base64Image = Buffer.from(imageBuffer).toString("base64");
              messages.push({
                role: "assistant",
                content: `I've generated an image for you: ${enhancedPrompt}`,
              });
              res.status(200).json({
                reply: `I've generated an image for you: ${enhancedPrompt}`,
                sessionId: currentSessionId,
                image: `data:image/png;base64,${base64Image}`,
                imagePrompt: enhancedPrompt,
              });
              return;
            }
          } catch (imageError) {}
        }
      }
      messages.push({ role: "assistant", content: assistantResponse });
      res.status(200).json({ reply: assistantResponse, sessionId: currentSessionId });
      return;
    }
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
}
