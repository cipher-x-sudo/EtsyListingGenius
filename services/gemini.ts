
import { GoogleGenAI } from "@google/genai";
import { ProductAnalysis, ThumbnailConfig } from "../types";

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
    
    5. 'suggestedScenes': Array of 10 creative photography settings/backgrounds suitable for this product's style (for mockup generation).
    
    6. 'seoReasoning': Brief explanation of how you mixed the user keywords with your strategy.

    7. 'thumbnailHeadline': The MAIN KEYWORD or OCCASION for the product (max 3-5 words). MUST be descriptive of what it is. 
       - Examples: "Valentine's Day Cards", "Christmas Wall Art", "Wedding Invitation", "Employee Appreciation".

    8. 'thumbnailBadge': A short badge text highlighting a key feature or count (e.g., "25 Pages", "Best Seller").

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
      responseModalities: ['image', 'text'],
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
    operation = await videoAi.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("No video URI returned");

  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!videoResponse.ok) throw new Error("Failed to download video file");

  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};

export const generateThumbnail = async (
  imageFiles: File[],
  config: ThumbnailConfig
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imageParts = await Promise.all(imageFiles.map(fileToGenerativePart));

  const layoutInstructions: Record<string, string> = {
    spread: `Arrange the product designs in a bold, modern flat-lay layout, with multiple items slightly overlapping and rotated at different natural angles (5-15°), similar to a high-end stationery brand photoshoot. Show ${Math.min(imageFiles.length, 12)} product variants visible to visually communicate a multi-item bundle.`,
    grid: `Arrange the product designs in a crisp, professional grid layout (3-4 columns) with consistent spacing. Each item should be clearly visible and slightly elevated with perspective. Style it like a product catalog showcase.`,
    collage: `Create a creative, editorial-style collage with the product designs at various sizes and dynamic angles, some overlapping artistically. The hero product should be 40% larger than supporting items. Create depth with layering.`,
    fan: `Fan out the products in an elegant semi-circular arc arrangement, overlapping like playing cards held in hand. The center product should be most prominent and slightly raised. Create a cascading depth effect.`,
  };

  const bgInstructions: Record<string, string> = {
    'pink-gradient': `Use a soft pink-to-lighter-pink gradient background, pastel and feminine aesthetic. Complement with subtle rose gold geometric accent lines.`,
    'pastel-floral': `Use a soft pastel watercolor background with subtle, tasteful botanical elements at the edges. Keep the center clean for the product showcase.`,
    'warm-earth': `Use warm earthy tones — terracotta, cream, tan gradient — with a cozy, artisanal aesthetic. Add subtle linen texture.`,
    'holiday': `Use a festive, seasonal background that matches the product theme. Add tasteful, subtle seasonal decorations at the edges only — don't compete with the products.`,
    'modern-minimal': `Use a clean white or very light pastel background to make the product designs and typography stand out clearly. Ultra-minimal, no distracting elements.`,
    'dark-luxury': `Use a deep charcoal or matte black background with subtle gold foil accent elements. Premium luxury aesthetic with rich contrast.`,
  };

  const layout = layoutInstructions[config.layoutStyle] || layoutInstructions['spread'];
  const bg = bgInstructions[config.backgroundStyle] || bgInstructions['modern-minimal'];

  const productContext = config.productTitle
    ? `using the uploaded ${config.productTitle} designs`
    : `using the uploaded product designs`;

  const styleContext = config.productStyle || 'modern, professional digital product';

  let prompt = `Create a premium, eye-catching Etsy listing thumbnail mockup in a perfect 1:1 square format (1080×1080 px, must be exactly square) ${productContext}.

LAYOUT & COMPOSITION:
${layout}

BACKGROUND:
${bg}

Add soft, realistic drop shadows beneath each product card/item to give a tangible, printed paper feel with realistic depth.

Keep the composition clean, typography-focused, and uncluttered — no heavy props or excessive decoration. The products themselves are the hero.
`;

  // Build text overlay section
  const textOverlays: string[] = [];

  // MANDATORY: Always include "Fully Editable with Canva"
  textOverlays.push(`• MANDATORY OVERLAY: "Fully Editable with Canva" — Place this prominently (e.g. top or bottom center) in a clean, legible badge or text overlay.`);
  //  Make sure the Canva logo is near it or implied.

  if (config.headlineText && config.headlineText.toLowerCase() !== 'fully editable with canva') {
    textOverlays.push(`• Clear, prominent overlay text reading: "${config.headlineText}" — place this in a bold, modern sans-serif font. Position it prominently on the image where it's immediately readable. Use high contrast against the background.`);
  }

  if (config.badgeText) {
    textOverlays.push(`• Add a circular or rounded badge element that reads: "${config.badgeText}" — make the key number/count LARGE and prominent inside the badge. Style the badge with a subtle shadow and a complementary accent color.`);
  }

  if (config.sizeText) {
    textOverlays.push(`• Add informational text: "${config.sizeText}" — place at the bottom area of the image in a clean, readable font. Slightly smaller than the headline but still clearly legible.`);
  }

  if (textOverlays.length > 0) {
    prompt += `\nTEXT OVERLAYS (render these as clean, sharp, readable text directly on the image):\n${textOverlays.join('\n')}\n`;
  }

  prompt += `
STYLE & MOOD:
- ${styleContext} aesthetic
- High-end digital product listing look for Etsy marketplace
- Text must be crisp, clean, and perfectly readable at thumbnail size
- All text should use modern sans-serif typography (like Montserrat, Poppins style)
- Strong visual hierarchy: products first, then badges, then supporting text

TECHNICAL REQUIREMENTS:
- Bright, even studio lighting with strong contrast for thumbnail visibility
- Ultra-high resolution, pixel-sharp focus
- Clean composition with intentional whitespace
- No watermarks, no stock photo artifacts
- Professional color grading that enhances the product colors
- Add a small, subtle CANVA logo in the top corner (clean, professional placement)
- The final result should look like it was created by a professional Etsy seller with top-tier branding
`;

  if (config.customInstructions) {
    prompt += `\nADDITIONAL CREATIVE DIRECTION:\n${config.customInstructions}\n`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        ...imageParts,
        { text: prompt }
      ]
    },
    config: {
      responseModalities: ['image', 'text'],
      imageConfig: {
        imageSize: "4K",
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
  throw new Error("Failed to generate thumbnail image");
};
