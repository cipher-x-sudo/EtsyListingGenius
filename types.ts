
export interface UserInput {
  productName: string;
  productDescription: string;
  materials: string;
  targetAudience: string;
  userKeywords?: string;
  images?: File[]; // Changed from single image to array
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface GeneratedAsset {
  id: string;
  type: 'image' | 'video' | 'thumbnail';
  url: string;
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  is4k?: boolean;
}

export interface ProductAnalysis {
  title: string;
  tags: string[];
  description: string;
  style: string;
  suggestedScenes: string[];
  seoReasoning?: string;
  thumbnailHeadline?: string;
  thumbnailBadge?: string;
}

export interface EtsyListingResponse extends ProductAnalysis {
  categoryPath?: string;
  priceSuggestion?: string;
  attributes?: Record<string, string>;
}

export interface ThumbnailConfig {
  headlineText: string;
  badgeText: string;
  sizeText: string;
  backgroundStyle: string;
  layoutStyle: string;
  customInstructions: string;
  productTitle?: string;
  productDescription?: string;
  productStyle?: string;
}
