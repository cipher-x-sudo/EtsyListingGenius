
import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  UploadIcon, SparklesIcon, DownloadIcon, ImageIcon, 
  VideoIcon, WandIcon, RefreshIcon, CopyIcon,
  SquareIcon, LandscapeIcon, PortraitIcon, PlusIcon, TrashIcon,
  XIcon, ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ArchiveIcon, TagIcon,
  FileTextIcon, LayoutGridIcon, TypeIcon, InfoIcon
} from './Icons';
import { analyzeProduct, generateMockupImage, generateProductVideo } from '../services/gemini';
import { ProductAnalysis, GeneratedAsset } from '../types';

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
  const [isThumbnailMode, setIsThumbnailMode] = useState(false);
  
  // Thumbnail Maker Controls
  const [thumbnailText, setThumbnailText] = useState("");

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

    // Async generations
    generateVideoAsset(referenceImage, analysis.description, videoId, veoAspectRatio);

    const batchSize = 3;
    for (let i = 0; i < imageIds.length; i += batchSize) {
      const batch = imageIds.slice(i, i + batchSize);
      await Promise.all(batch.map(item => generateImageAsset(referenceImage, item.prompt, item.id, aspectRatio)));
    }

    setIsGenerating(false);
  };

  const handleQuickThumbnail = async (style: string) => {
      if (images.length === 0) return;
      
      const aistudio = (window as any).aistudio;
      if (aistudio) {
          const selected = await aistudio.hasSelectedApiKey();
          if (!selected) await handleOpenKeySelector();
      }

      const referenceImage = images[selectedImageIndex];
      const id = `thumb-${Date.now()}`;
      
      let basePrompt = "";
      switch(style) {
          case 'studio': basePrompt = "Product placed on a pristine white podium, bright studio lighting, high-end commercial style"; break;
          case 'lifestyle': basePrompt = "Product in a cozy sunlit home environment, blurry background, lifestyle aesthetic"; break;
          case 'flatlay': basePrompt = "Top-down flatlay composition, neutral background, artistic botanical props"; break;
          case 'seasonal': basePrompt = "Product with seasonal festive decor, moody cinematic lighting"; break;
      }
      
      if (thumbnailText) {
          basePrompt += `. Naturally incorporate the text "${thumbnailText}" on a tag or sign.`;
      }

      const newAsset: GeneratedAsset = {
          id,
          type: 'image',
          prompt: basePrompt,
          status: 'generating',
          url: '',
          is4k: true
      };

      setAssets(prev => [newAsset, ...prev]);
      generateImageAsset(referenceImage, basePrompt, id, aspectRatio);
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

    if (asset.type === 'video') {
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
    let aspectClass = isVideo ? '' : (aspectRatio === '16:9' ? 'aspect-video' : (aspectRatio === '9:16' ? 'aspect-[9/16]' : 'aspect-square'));
    let spanClass = isVideo ? 'col-span-2 row-span-2' : (aspectRatio === '16:9' ? 'col-span-2' : 'col-span-1');
    
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
                   <p className="text-xs font-bold">Permission Required</p>
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleRetryAsset(asset); }} 
                     className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                   >
                     Fix with Key
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
            <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm flex items-center gap-1">
               {isVideo ? <VideoIcon className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
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
             <div className="space-y-6 animate-fadeIn">
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

                <div className="space-y-3 bg-gradient-to-br from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-100">
                    <label className="text-xs font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-1">
                        <LayoutGridIcon className="w-3 h-3" /> Thumbnail Studio
                    </label>
                    <div className="bg-white rounded-md border border-indigo-100 p-2 flex items-center gap-2">
                        <TypeIcon className="w-3 h-3 text-slate-400" />
                        <input 
                            type="text" 
                            value={thumbnailText}
                            onChange={(e) => setThumbnailText(e.target.value)}
                            placeholder="Overlay text (Sale, New...)" 
                            className="text-xs w-full outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {['studio', 'lifestyle', 'flatlay', 'seasonal'].map(style => (
                          <button key={style} onClick={() => handleQuickThumbnail(style)} className="bg-white hover:bg-slate-50 border border-indigo-100 rounded p-2 text-center transition">
                            <span className="text-[10px] font-bold text-slate-600 capitalize">{style}</span>
                          </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">3. Visual Style</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                       <button onClick={() => setAspectRatio('1:1')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${aspectRatio === '1:1' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>1:1</button>
                       <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${aspectRatio === '9:16' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>9:16</button>
                       <button onClick={() => setAspectRatio('16:9')} className={`flex-1 py-1.5 rounded-md text-xs font-medium ${aspectRatio === '16:9' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>16:9</button>
                    </div>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">4. Scenes</label>
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
               ${!analysis || isGenerating ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all'}`}
           >
             {isGenerating ? <RefreshIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
             {isGenerating ? 'Generating...' : 'Generate Studio Pack'}
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
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-min pb-10">
                  {assets.map(renderAssetCard)}
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
