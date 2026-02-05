
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
  type: 'image' | 'video';
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
}

export interface EtsyListingResponse extends ProductAnalysis {
  categoryPath?: string;
  priceSuggestion?: string;
  attributes?: Record<string, string>;
}
