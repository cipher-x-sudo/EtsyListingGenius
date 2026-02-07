
import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  UploadIcon, SparklesIcon, DownloadIcon, ImageIcon,
  VideoIcon, WandIcon, RefreshIcon, CopyIcon,
  SquareIcon, LandscapeIcon, PortraitIcon, PlusIcon, TrashIcon,
  XIcon, ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ArchiveIcon, TagIcon,
  FileTextIcon, LayoutGridIcon, TypeIcon, InfoIcon
} from './Icons';
import { analyzeProduct, generateMockupImage, generateProductVideo, generateThumbnail } from '../services/gemini';
import { ProductAnalysis, GeneratedAsset, ThumbnailConfig } from '../types';

const MockupGenerator: React.FC = () => {
  // API Key State
  const [hasApiKey, setHasApiKey] = useState<boolean>(true); // Assume true initially to check
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // State
  const [images, setImages] = useState<File[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [userKeywords, setUserKeywords] = useState("");
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);

  // Loading States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Controls
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');

  // Thumbnail Config
  const [thumbHeadline, setThumbHeadline] = useState('');
  const [thumbBadge, setThumbBadge] = useState('');
  const [thumbSize, setThumbSize] = useState('');
  const [thumbBgStyle, setThumbBgStyle] = useState('pink-gradient');
  const [thumbLayout, setThumbLayout] = useState('spread');
  const [thumbInstructions, setThumbInstructions] = useState('');

  // Modal State
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Initial check for API key
  useEffect(() => {
    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const selected = await aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
      setIsCheckingKey(false);
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setHasApiKey(true); // Assume success after interaction
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      setImages(newFiles);
      setSelectedImageIndex(0);
      setAnalysis(null);
      setAssets([]);
      setScenarios([]);

      // Auto-analyze
      runAnalysis(newFiles, userKeywords);
    }
  };

  const runAnalysis = async (files: File[], keywords: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeProduct(files, keywords);
      setAnalysis(result);
      setScenarios(result.suggestedScenes);
      if (result.thumbnailHeadline) setThumbHeadline(result.thumbnailHeadline);
      if (result.thumbnailBadge) setThumbBadge(result.thumbnailBadge);
    } catch (err: any) {
      console.error("Analysis failed", err);
      if (err?.message?.includes('403') || err?.message?.includes('permission') || err?.message?.includes('not found')) {
        handleOpenKeySelector();
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRegenerateMetadata = () => {
    if (images.length > 0) {
      runAnalysis(images, userKeywords);
    }
  };

  const handleScenarioChange = (index: number, value: string) => {
    const newScenarios = [...scenarios];
    newScenarios[index] = value;
    setScenarios(newScenarios);
  };

  const handleAddScenario = () => {
    setScenarios([...scenarios, ""]);
  };

  const handleRemoveScenario = (index: number) => {
    setScenarios(scenarios.filter((_, i) => i !== index));
  };

  const handleGenerateAssets = async () => {
    if (images.length === 0 || !analysis) return;

    // Check key selection again
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      const selected = await aistudio.hasSelectedApiKey();
      if (!selected) {
        await handleOpenKeySelector();
      }
    }

    setIsGenerating(true);
    const referenceImage = images[selectedImageIndex];
    const newAssets: GeneratedAsset[] = [];

    // 1. Thumbnail
    const thumbId = `thumb-${Date.now()}`;
    newAssets.push({
      id: thumbId,
      type: 'thumbnail',
      prompt: `Thumbnail: ${thumbHeadline || 'Product Showcase'}`,
      status: 'generating',
      url: '',
      is4k: true
    });

    // 2. Video
    const videoId = `video-${Date.now()}`;
    const veoAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
    newAssets.push({
      id: videoId,
      type: 'video',
      prompt: `Cinematic video of ${analysis.description}`,
      status: 'generating',
      url: '',
      is4k: true
    });

    // 3. Mockup Images
    const activeScenarios = scenarios.filter(s => s.trim().length > 0);
    const imageIds = activeScenarios.map((prompt, idx) => {
      const id = `img-${Date.now()}-${idx}`;
      newAssets.push({
        id,
        type: 'image',
        prompt,
        status: 'pending',
        url: '',
        is4k: true
      });
      return { id, prompt };
    });

    setAssets(prev => [...prev, ...newAssets]);

    // Launch all generations in parallel
    // Thumbnail
    const thumbConfig: ThumbnailConfig = {
      headlineText: thumbHeadline,
      badgeText: thumbBadge,
      sizeText: thumbSize,
      backgroundStyle: thumbBgStyle,
      layoutStyle: thumbLayout,
      customInstructions: thumbInstructions,
      productTitle: analysis.title,
      productDescription: analysis.description,
      productStyle: analysis.style,
    };
    generateThumbnail(images, thumbConfig)
      .then(url => setAssets(prev => prev.map(a => a.id === thumbId ? { ...a, status: 'completed', url } : a)))
      .catch(() => setAssets(prev => prev.map(a => a.id === thumbId ? { ...a, status: 'error' } : a)));

    // Video
    generateVideoAsset(referenceImage, analysis.description, videoId, veoAspectRatio);

    // Mockups in batches
    const batchSize = 3;
    for (let i = 0; i < imageIds.length; i += batchSize) {
      const batch = imageIds.slice(i, i + batchSize);
      await Promise.all(batch.map(item => generateImageAsset(referenceImage, item.prompt, item.id, aspectRatio)));
    }

    setIsGenerating(false);
  };



  const generateImageAsset = async (file: File, prompt: string, id: string, ratio: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'generating' } : a));
    try {
      const url = await generateMockupImage(file, prompt, ratio);
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'completed', url, is4k: true } : a));
    } catch (error: any) {
      console.error(error);
      const isPermError = error?.message?.includes('403') || error?.message?.includes('permission');
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a));
      if (isPermError) handleOpenKeySelector();
    }
  };

  const generateVideoAsset = async (file: File, description: string, id: string, ratio: '16:9' | '9:16') => {
    try {
      const url = await generateProductVideo(file, description, ratio);
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'completed', url } : a));
    } catch (error: any) {
      console.error("Video failed", error);
      const isPermError = error?.message?.includes('403') || error?.message?.includes('permission');
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a));
      if (isPermError) handleOpenKeySelector();
    }
  };

  const handleRetryAsset = async (asset: GeneratedAsset) => {
    if (images.length === 0) return;
    const referenceImage = images[selectedImageIndex];

    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
    }

    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'generating' } : a));

    if (asset.type === 'thumbnail') {
      const thumbConfig: ThumbnailConfig = {
        headlineText: thumbHeadline,
        badgeText: thumbBadge,
        sizeText: thumbSize,
        backgroundStyle: thumbBgStyle,
        layoutStyle: thumbLayout,
        customInstructions: thumbInstructions,
        productTitle: analysis?.title,
        productDescription: analysis?.description,
        productStyle: analysis?.style,
      };
      generateThumbnail(images, thumbConfig)
        .then(url => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'completed', url } : a)))
        .catch(() => setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'error' } : a)));
    } else if (asset.type === 'video') {
      generateVideoAsset(referenceImage, analysis?.description || asset.prompt, asset.id, aspectRatio === '9:16' ? '9:16' : '16:9');
    } else {
      generateImageAsset(referenceImage, asset.prompt, asset.id, aspectRatio);
    }
  };

  const handleDownloadZip = async () => {
    const completedAssets = assets.filter(a => a.status === 'completed');
    if (completedAssets.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      await Promise.all(completedAssets.map(async (asset) => {
        const response = await fetch(asset.url);
        const blob = await response.blob();
        const ext = asset.type === 'video' ? 'mp4' : 'png';
        zip.file(`etsy-${asset.type}-${asset.id.slice(-6)}.${ext}`, blob);
      }));

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `etsy-assets-${Date.now()}.zip`;
      link.click();
    } catch (e) {
      alert("ZIP failed.");
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleNextAsset = () => {
    if (!selectedAssetId) return;
    const currentIndex = assets.findIndex(a => a.id === selectedAssetId);
    if (currentIndex < assets.length - 1) setSelectedAssetId(assets[currentIndex + 1].id);
  };

  const handlePrevAsset = () => {
    if (!selectedAssetId) return;
    const currentIndex = assets.findIndex(a => a.id === selectedAssetId);
    if (currentIndex > 0) setSelectedAssetId(assets[currentIndex - 1].id);
  };

  const renderAssetCard = (asset: GeneratedAsset) => {
    const isVideo = asset.type === 'video';
    const isThumbnail = asset.type === 'thumbnail';
    let aspectClass = isVideo ? '' : (isThumbnail ? 'aspect-square' : (aspectRatio === '16:9' ? 'aspect-video' : (aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square')));
    let spanClass = isVideo ? 'col-span-2 row-span-2' : (isThumbnail ? 'col-span-1' : (aspectRatio === '16:9' ? 'col-span-2' : 'col-span-1'));

    const badgeColor = isThumbnail ? 'bg-purple-500' : (isVideo ? 'bg-blue-500' : 'bg-indigo-500');
    const typeIcon = isVideo ? <VideoIcon className="w-3 h-3" /> : (isThumbnail ? <LayoutGridIcon className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />);

    return (
      <div
        key={asset.id}
        className={`group relative rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-slate-50 cursor-pointer ${spanClass} ${aspectClass}`}
        onClick={() => asset.status === 'completed' && setSelectedAssetId(asset.id)}
      >
        {asset.status === 'completed' ? (
          <>
            {isVideo ? (
              <video src={asset.url} className="w-full h-full object-cover" muted />
            ) : (
              <img src={asset.url} alt={asset.prompt} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
            )}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                <ZoomInIcon className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-800">View 4K</span>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            {asset.status === 'error' ? (
              <div className="text-red-400">
                <span className="text-2xl block mb-2">⚠️</span>
                <p className="text-xs font-bold">Generation Failed</p>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRetryAsset(asset); }}
                  className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                <p className="text-xs text-slate-500 font-medium animate-pulse">Rendering...</p>
              </>
            )}
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1 z-10 pointer-events-none">
          <div className={`${badgeColor} text-white backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1`}>
            {typeIcon}
            {asset.type}
          </div>
          {asset.is4k && <div className="bg-green-500 text-white px-2 py-1 rounded-md text-[10px] font-bold">4K</div>}
        </div>
      </div>
    );
  };

  if (isCheckingKey) return <div className="flex items-center justify-center h-full text-slate-400">Loading workspace...</div>;

  if (!hasApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center space-y-6 animate-fadeIn">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
          <WandIcon className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Setup Studio Workspace</h2>
          <p className="text-slate-600 mt-2">
            To generate high-quality 4K mockups and videos, you must connect a paid Google Cloud project.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800 flex gap-3 text-left">
          <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">Billing Required</p>
            <p>Professional generation models (Gemini Pro & Veo) require a billing-enabled account.</p>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-indigo-600 font-bold underline mt-2 inline-block">Learn about billing</a>
          </div>
        </div>
        <button
          onClick={handleOpenKeySelector}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition active:scale-95"
        >
          Select Paid API Key
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-6 overflow-hidden">

      {/* Sidebar - Controls */}
      <div className="w-full lg:w-96 flex-shrink-0 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col overflow-hidden h-full">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <WandIcon className="w-5 h-5 text-indigo-600" />
            Etsy Studio
          </h2>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Workspace Ready</p>
            <button onClick={handleOpenKeySelector} className="text-[10px] text-indigo-600 hover:underline">Change Key</button>
          </div>
        </div>

        <div className="p-5 flex-grow overflow-y-auto space-y-6 custom-scrollbar">
          {/* Step 1: Photos */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">1. Product Photos</label>
            <div className="mb-2">
              <input
                type="text"
                value={userKeywords}
                onChange={(e) => setUserKeywords(e.target.value)}
                placeholder="SEO keywords (boho, handmade)..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-4 hover:bg-slate-50 transition text-center cursor-pointer bg-slate-50/50">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <UploadIcon className="w-6 h-6 text-slate-400 mb-1" />
                <p className="text-xs text-slate-500">{images.length > 0 ? 'Add more images' : 'Upload photos'}</p>
              </div>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 ${selectedImageIndex === idx ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-200'}`}
                  >
                    <img src={URL.createObjectURL(img)} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {isAnalyzing && (
            <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 p-3 rounded-lg text-sm">
              <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              Analyzing assets...
            </div>
          )}

          {analysis && !isAnalyzing && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">2. Generated SEO</label>
                  <button onClick={handleRegenerateMetadata} className="text-[10px] text-indigo-600 hover:underline">Refresh</button>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3 shadow-sm text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">SEO TITLE</span>
                    <p className="text-slate-800 font-medium leading-snug">{analysis.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {analysis.tags.slice(0, 10).map((tag, i) => (
                      <span key={i} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Thumbnail Config */}
              <div className="space-y-3 bg-gradient-to-br from-purple-50 to-indigo-50 p-3 rounded-lg border border-purple-100">
                <label className="text-xs font-bold text-purple-800 uppercase tracking-wide flex items-center gap-1">
                  <LayoutGridIcon className="w-3 h-3" /> 3. Thumbnail
                </label>
                <div className="space-y-1.5">
                  <input type="text" value={thumbHeadline} onChange={e => setThumbHeadline(e.target.value)} placeholder="Headline (e.g. Fully Editable with Canva)" className="w-full text-xs px-2.5 py-1.5 rounded border border-purple-100 outline-none focus:ring-1 focus:ring-purple-400 bg-white" />
                  <input type="text" value={thumbBadge} onChange={e => setThumbBadge(e.target.value)} placeholder="Badge (e.g. 15 Valentine's Day Cards)" className="w-full text-xs px-2.5 py-1.5 rounded border border-purple-100 outline-none focus:ring-1 focus:ring-purple-400 bg-white" />
                  <input type="text" value={thumbSize} onChange={e => setThumbSize(e.target.value)} placeholder="Size info (e.g. Size: 5×7 inch)" className="w-full text-xs px-2.5 py-1.5 rounded border border-purple-100 outline-none focus:ring-1 focus:ring-purple-400 bg-white" />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'pink-gradient', label: 'Pink' },
                    { id: 'pastel-floral', label: 'Pastel' },
                    { id: 'warm-earth', label: 'Warm' },
                    { id: 'holiday', label: 'Holiday' },
                    { id: 'modern-minimal', label: 'Minimal' },
                    { id: 'dark-luxury', label: 'Dark' },
                  ].map(bg => (
                    <button key={bg.id} onClick={() => setThumbBgStyle(bg.id)}
                      className={`py-1 rounded text-[10px] font-bold transition ${thumbBgStyle === bg.id ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-purple-100 hover:border-purple-300'}`}
                    >{bg.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {['spread', 'grid', 'collage', 'fan'].map(l => (
                    <button key={l} onClick={() => setThumbLayout(l)}
                      className={`py-1 rounded text-[10px] font-bold capitalize transition ${thumbLayout === l ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 border border-purple-100 hover:border-purple-300'}`}
                    >{l}</button>
                  ))}
                </div>
                <textarea value={thumbInstructions} onChange={e => setThumbInstructions(e.target.value)} rows={2} placeholder="Special instructions (optional)..." className="w-full text-xs p-2 rounded border border-purple-100 outline-none resize-none focus:ring-1 focus:ring-purple-400 bg-white" />
                <button
                  onClick={() => {
                    if (images.length === 0) return;
                    const id = `thumb-${Date.now()}`;
                    setAssets(prev => [{
                      id, type: 'thumbnail', prompt: `Thumbnail: ${thumbHeadline || 'Product Showcase'}`,
                      status: 'generating', url: '', is4k: true
                    }, ...prev]);
                    const cfg: ThumbnailConfig = {
                      headlineText: thumbHeadline, badgeText: thumbBadge, sizeText: thumbSize,
                      backgroundStyle: thumbBgStyle, layoutStyle: thumbLayout, customInstructions: thumbInstructions,
                      productTitle: analysis?.title, productDescription: analysis?.description, productStyle: analysis?.style,
                    };
                    generateThumbnail(images, cfg)
                      .then(url => setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'completed', url } : a)))
                      .catch(() => setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a)));
                  }}
                  disabled={images.length === 0 || isGenerating}
                  className={`w-full py-1.5 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all
                    ${images.length === 0 || isGenerating ? 'bg-slate-200 text-slate-400' : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98]'}`}
                >
                  <LayoutGridIcon className="w-3 h-3" /> Generate Thumbnail
                </button>
              </div>

              {/* 4. Visual Style */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">4. Mockup Style</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setAspectRatio('1:1')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${aspectRatio === '1:1' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>1:1</button>
                  <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${aspectRatio === '9:16' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>9:16</button>
                  <button onClick={() => setAspectRatio('16:9')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${aspectRatio === '16:9' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>16:9</button>
                </div>
              </div>

              {/* 5. Scenes */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">5. Scenes</label>
                  <button onClick={handleAddScenario} className="text-indigo-600"><PlusIcon className="w-4 h-4" /></button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {scenarios.map((scene, i) => (
                    <div key={i} className="flex gap-2 group">
                      <textarea
                        value={scene}
                        onChange={(e) => handleScenarioChange(i, e.target.value)}
                        rows={2}
                        className="flex-1 text-xs p-2 rounded border border-slate-200 outline-none resize-none"
                        placeholder="Scene detail..."
                      />
                      <button onClick={() => handleRemoveScenario(i)} className="text-slate-300 hover:text-red-500"><TrashIcon className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 bg-white">
          <button
            onClick={handleGenerateAssets}
            disabled={!analysis || isGenerating}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2
               ${!analysis || isGenerating ? 'bg-slate-300' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition-all'}`}
          >
            {isGenerating ? <RefreshIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
            {isGenerating ? 'Generating All...' : 'Generate Full Pack'}
          </button>
        </div>
      </div>

      {/* Main Gallery Area */}
      <div className="flex-grow flex flex-col bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">Studio Gallery</h3>
          {assets.some(a => a.status === 'completed') && (
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {isZipping ? <RefreshIcon className="w-3 h-3 animate-spin" /> : <ArchiveIcon className="w-3 h-3" />}
              Download ZIP
            </button>
          )}
        </div>

        <div className="flex-grow overflow-y-auto p-6 custom-scrollbar">
          {assets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
              <ImageIcon className="w-10 h-10 mb-2" />
              <p className="text-lg font-medium">Studio Empty</p>
              <p className="text-xs">Upload photos to start generating assets.</p>
            </div>
          ) : (
            <div className="space-y-8 pb-10">
              {/* Thumbnails Section */}
              {assets.filter(a => a.type === 'thumbnail').length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <h4 className="text-sm font-bold text-slate-700">Thumbnails</h4>
                    <span className="text-[10px] text-slate-400 font-medium">{assets.filter(a => a.type === 'thumbnail').length} items</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
                    {assets.filter(a => a.type === 'thumbnail').map(renderAssetCard)}
                  </div>
                </div>
              )}

              {/* Videos Section */}
              {assets.filter(a => a.type === 'video').length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <h4 className="text-sm font-bold text-slate-700">Videos</h4>
                    <span className="text-[10px] text-slate-400 font-medium">{assets.filter(a => a.type === 'video').length} items</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-min">
                    {assets.filter(a => a.type === 'video').map(renderAssetCard)}
                  </div>
                </div>
              )}

              {/* Mockups Section */}
              {assets.filter(a => a.type === 'image').length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <h4 className="text-sm font-bold text-slate-700">Mockups</h4>
                    <span className="text-[10px] text-slate-400 font-medium">{assets.filter(a => a.type === 'image').length} items</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-min">
                    {assets.filter(a => a.type === 'image').map(renderAssetCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedAssetId && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn" onClick={() => setSelectedAssetId(null)}>
          <button className="absolute top-4 right-4 text-white p-2 rounded-full"><XIcon className="w-6 h-6" /></button>
          <div className="max-w-[90vw] max-h-[85vh]" onClick={e => e.stopPropagation()}>
            {assets.find(a => a.id === selectedAssetId)?.type === 'video' ? (
              <video src={assets.find(a => a.id === selectedAssetId)?.url} controls autoPlay className="max-h-[85vh] rounded-lg" />
            ) : (
              <img src={assets.find(a => a.id === selectedAssetId)?.url} className="max-h-[85vh] rounded-lg" />
            )}
          </div>
          <div className="mt-6 flex items-center gap-4 bg-black/60 px-6 py-3 rounded-full border border-white/10">
            <button onClick={() => handleDownload(assets.find(a => a.id === selectedAssetId)!.url, 'studio-asset.png')} className="text-white hover:text-indigo-400 flex items-center gap-1 text-sm font-bold">
              <DownloadIcon className="w-4 h-4" /> Download 4K
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockupGenerator;
