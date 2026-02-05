
import { GoogleGenAI } from "@google/genai";
import { ProductAnalysis } from "../types";

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeProduct = async (imageFiles: File[], userKeywords?: string): Promise<ProductAnalysis> => {
  // Create a fresh instance to use the latest selected API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Convert all images to generative parts
  const imageParts = await Promise.all(imageFiles.map(fileToGenerativePart));
  
  const prompt = `
    Analyze these product images to create high-quality Etsy listing metadata and creative assets.
    I have provided ${imageFiles.length} images of the product. Use all of them to understand details, angles, and features.
    
    User's Specific Keywords (MUST USE): ${userKeywords || "None provided"}

    You must return a valid JSON object with the following keys:
    1. 'title': An optimized Etsy title.
       - Rules: MAX 125 CHARACTERS.
       - CRITICAL: STRICTLY AVOID KEYWORD STUFFING. Do not repeat words.
       - Write a natural, human-readable sentence fragment. 
       - MUST include the User's Specific Keywords (if provided) naturally near the beginning.
    
    2. 'tags': Array of 13 strings.
       - Rules: Mix User's Specific Keywords with high-traffic AI suggestions.
       - Max 20 chars per tag. 
       - Varied vocabulary (no repetition of root words).
    
    3. 'description': A compelling, professional listing description.
       - FORMATTING RULES (Strict):
         * NO WALLS OF TEXT. Use short paragraphs (max 2-3 sentences).
         * Use BULLET POINTS for features, dimensions, and materials.
         * Proper punctuation and capitalization (NO ALL CAPS).
         * Avoid excessive emojis.
       - CONTENT:
         * Include separate small headers/sections like "About this Item", "Materials", "Dimensions/Size", and "Care Instructions".
         * Weave keywords naturally into sentences, do not list them.
    
    4. 'style': The aesthetic style of the product (e.g., "Boho Rustic", "Modern Minimalist").
    
    5. 'suggestedScenes': Array of 5 creative photography settings/backgrounds suitable for this product's style (for mockup generation).
    
    6. 'seoReasoning': Brief explanation of how you mixed the user keywords with your strategy.

    Return ONLY the JSON.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // Using a reliable vision-capable model for analysis
    contents: {
      parts: [
        ...imageParts,
        { text: prompt }
      ]
    }
  });

  let text = "";
  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) text += part.text;
    }
  }
  
  const jsonStr = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(jsonStr) as ProductAnalysis;
  } catch (e) {
    console.error("Failed to parse JSON", jsonStr);
    throw new Error("Failed to generate valid JSON analysis");
  }
};

export const generateMockupImage = async (imageFile: File, scenePrompt: string, aspectRatio: string = "1:1"): Promise<string> => {
  // Fresh instance for every image generation
  const proAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(imageFile);
  
  const response = await proAi.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        imagePart,
        { text: `Create a 4K resolution, photorealistic product mockup. Place the product from the image into this scene: ${scenePrompt}. Maintain the product's original appearance perfectly. Lighting, shadows, and reflections must be professional studio quality.` }
      ]
    },
    config: {
      imageConfig: { 
        imageSize: "4K", 
        aspectRatio: aspectRatio 
      }
    }
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("Failed to generate mockup image");
};

export const generateProductVideo = async (imageFile: File, description: string, aspectRatio: '16:9' | '9:16' = '16:9'): Promise<string> => {
  const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(imageFile);

  const veoImage = {
    imageBytes: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType
  };

  let operation = await videoAi.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Cinematic, professional product video of ${description}. smooth camera movement, 4k quality, highly detailed, photorealistic, slow motion product showcase.`,
    image: veoImage,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await videoAi.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("No video URI returned");

  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!videoResponse.ok) throw new Error("Failed to download video file");
  
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};
