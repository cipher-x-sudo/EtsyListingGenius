
import React, { useState } from 'react';
import { SparklesIcon, RefreshIcon, ImageIcon } from './Icons';
import { generateThumbnail } from '../services/gemini';
import { ThumbnailConfig, GeneratedAsset } from '../types';

// Icons used locally
const PaintBrushIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" /><path d="m5 2 5 5" /><path d="M2 13h6" /><path d="m20 2-5 5" /></svg>
);

const LayersIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></svg>
);

const TextIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" x2="15" y1="20" y2="20" /><line x1="12" x2="12" y1="4" y2="20" /></svg>
);

const backgroundStyles = [
    { id: 'pink-gradient', label: 'Pink Gradient', color: 'bg-gradient-to-br from-pink-200 to-pink-100' },
    { id: 'pastel-floral', label: 'Pastel Floral', color: 'bg-gradient-to-br from-purple-100 to-blue-100' },
    { id: 'warm-earth', label: 'Warm Earth', color: 'bg-gradient-to-br from-amber-100 to-orange-100' },
    { id: 'holiday', label: 'Holiday', color: 'bg-gradient-to-br from-red-100 to-green-100' },
    { id: 'modern-minimal', label: 'Minimal', color: 'bg-gradient-to-br from-gray-100 to-white' },
    { id: 'dark-luxury', label: 'Dark Luxury', color: 'bg-gradient-to-br from-gray-800 to-gray-900' },
];

const layoutStyles = [
    { id: 'spread', label: 'Spread', desc: 'Cards fanned out' },
    { id: 'grid', label: 'Grid', desc: 'Clean rows & columns' },
    { id: 'collage', label: 'Collage', desc: 'Creative overlap' },
    { id: 'fan', label: 'Fan Arc', desc: 'Semi-circular arc' },
];

interface ThumbnailMakerProps {
    images: File[];
    selectedImageIndex: number;
    onAssetAdd: (asset: GeneratedAsset) => void;
    onAssetUpdate: (id: string, updates: Partial<GeneratedAsset>) => void;
}

const ThumbnailMaker: React.FC<ThumbnailMakerProps> = ({ images, selectedImageIndex, onAssetAdd, onAssetUpdate }) => {
    const [headlineText, setHeadlineText] = useState('');
    const [badgeText, setBadgeText] = useState('');
    const [sizeText, setSizeText] = useState('');
    const [backgroundStyle, setBackgroundStyle] = useState('pink-gradient');
    const [layoutStyle, setLayoutStyle] = useState('spread');
    const [customInstructions, setCustomInstructions] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (images.length === 0) return;

        setIsGenerating(true);
        const id = `thumb-${Date.now()}`;

        const newAsset: GeneratedAsset = {
            id,
            type: 'thumbnail',
            url: '',
            prompt: `Thumbnail: ${headlineText || 'Product Showcase'}`,
            status: 'generating',
            is4k: true,
        };
        onAssetAdd(newAsset);

        const config: ThumbnailConfig = {
            headlineText,
            badgeText,
            sizeText,
            backgroundStyle,
            layoutStyle,
            customInstructions,
        };

        try {
            const url = await generateThumbnail(images, config);
            onAssetUpdate(id, { status: 'completed', url });
        } catch (err: any) {
            console.error("Thumbnail generation failed:", err);
            onAssetUpdate(id, { status: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-5 animate-fadeIn">
            {/* Text Overlays Section */}
            <div className="space-y-3">
                <label className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                    <TextIcon className="w-3.5 h-3.5" /> Text Overlays
                </label>

                <div className="space-y-2">
                    <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Headline</span>
                        <input
                            type="text"
                            value={headlineText}
                            onChange={e => setHeadlineText(e.target.value)}
                            placeholder="e.g. Fully Editable with Canva"
                            className="w-full text-xs outline-none text-slate-800 placeholder:text-slate-300"
                        />
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Badge / Count</span>
                        <input
                            type="text"
                            value={badgeText}
                            onChange={e => setBadgeText(e.target.value)}
                            placeholder="e.g. 15 Valentine's Day Cards"
                            className="w-full text-xs outline-none text-slate-800 placeholder:text-slate-300"
                        />
                    </div>

                    <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Size / Info</span>
                        <input
                            type="text"
                            value={sizeText}
                            onChange={e => setSizeText(e.target.value)}
                            placeholder="e.g. Size: 5×7 inch"
                            className="w-full text-xs outline-none text-slate-800 placeholder:text-slate-300"
                        />
                    </div>
                </div>
            </div>

            {/* Background Style */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                    <PaintBrushIcon className="w-3.5 h-3.5" /> Background
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                    {backgroundStyles.map(bg => (
                        <button
                            key={bg.id}
                            onClick={() => setBackgroundStyle(bg.id)}
                            className={`relative p-2 rounded-lg border-2 transition-all text-center ${backgroundStyle === bg.id
                                    ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-sm'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <div className={`w-full h-5 rounded ${bg.color} mb-1`}></div>
                            <span className="text-[10px] font-medium text-slate-600 leading-tight block">{bg.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Layout Style */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                    <LayersIcon className="w-3.5 h-3.5" /> Layout
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                    {layoutStyles.map(l => (
                        <button
                            key={l.id}
                            onClick={() => setLayoutStyle(l.id)}
                            className={`p-2.5 rounded-lg border-2 transition-all text-left ${layoutStyle === l.id
                                    ? 'border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50'
                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                        >
                            <span className="text-[11px] font-bold text-slate-700 block">{l.label}</span>
                            <span className="text-[10px] text-slate-400">{l.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Instructions */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
                    <SparklesIcon className="w-3.5 h-3.5" /> Special Instructions
                </label>
                <textarea
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    rows={3}
                    placeholder="Any special instructions... e.g. 'Add hearts and confetti', 'Make the Canva logo visible in top-left corner', 'Use red and white color scheme'"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none resize-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-300"
                />
            </div>

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={images.length === 0 || isGenerating}
                className={`w-full py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all
          ${images.length === 0 || isGenerating
                        ? 'bg-slate-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98]'
                    }`}
            >
                {isGenerating ? <RefreshIcon className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                {isGenerating ? 'Creating Thumbnail...' : `Generate Thumbnail (${images.length} image${images.length !== 1 ? 's' : ''})`}
            </button>
        </div>
    );
};

export default ThumbnailMaker;
