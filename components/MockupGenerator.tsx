import React, { useState } from 'react';
import JSZip from 'jszip';
import { 
  UploadIcon, SparklesIcon, DownloadIcon, ImageIcon, 
  VideoIcon, WandIcon, RefreshIcon, CopyIcon,
  SquareIcon, LandscapeIcon, PortraitIcon, PlusIcon, TrashIcon,
  XIcon, ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ArchiveIcon, TagIcon,
  FileTextIcon
} from './Icons';
import { analyzeProduct, generateMockupImage, generateProductVideo } from '../services/gemini';
import { ProductAnalysis, GeneratedAsset } from '../types';

const MockupGenerator: React.FC = () => {
  // State
  const [image, setImage] = useState<File | null>(null);
  const [userKeywords, setUserKeywords] = useState("");
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  
  // New State for Advanced Controls
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [isThumbnailMode, setIsThumbnailMode] = useState(false);

  // Modal State
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setAnalysis(null);
      setAssets([]);
      setScenarios([]);
      
      // Auto-analyze on upload (passing current keywords if any)
      runAnalysis(file, userKeywords);
    }
  };

  const runAnalysis = async (file: File, keywords: string) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeProduct(file, keywords);
      setAnalysis(result);
      setScenarios(result.suggestedScenes);
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRegenerateMetadata = () => {
    if (image) {
      runAnalysis(image, userKeywords);
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
    if (!image || !analysis) return;
    setIsGenerating(true);

    // CRITICAL: Check for Paid API Key before starting, as we default to 4K Pro model
    const aistudio = (window as any).aistudio;
    if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await aistudio.openSelectKey();
        }
    }

    // 1. Prepare asset placeholders
    const newAssets: GeneratedAsset[] = [];
    
    // Add Video Placeholder
    const videoId = `video-${Date.now()}`;
    // Veo strictly only supports 16:9 or 9:16. We map 1:1 to 16:9.
    const veoAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9'; 

    newAssets.push({
      id: videoId,
      type: 'video',
      prompt: `Cinematic video of ${analysis.description}`,
      status: 'generating',
      url: '',
      is4k: true // Veo is high quality
    });

    // Add Image Placeholders from Editable Scenarios
    // Filter out empty scenarios
    const activeScenarios = scenarios.filter(s => s.trim().length > 0);
    
    const imageIds = activeScenarios.map((prompt, idx) => {
      const id = `img-${Date.now()}-${idx}`;
      // Append Thumbnail style if enabled
      const finalPrompt = isThumbnailMode 
        ? `${prompt}. High contrast, vibrant colors, clear focal point, professional YouTube thumbnail style, engaging composition, highly detailed.` 
        : prompt;

      newAssets.push({
        id,
        type: 'image',
        prompt: finalPrompt,
        status: 'pending',
        url: '',
        is4k: true // Defaulting to 4K now
      });
      return { id, prompt: finalPrompt };
    });

    setAssets(newAssets);

    // 2. Start Video Generation (Async)
    generateVideoAsset(image, analysis.description, videoId, veoAspectRatio);

    // 3. Start Image Generation (Parallel/Batched)
    const batchSize = 3;
    for (let i = 0; i < imageIds.length; i += batchSize) {
      const batch = imageIds.slice(i, i + batchSize);
      await Promise.all(batch.map(item => generateImageAsset(image, item.prompt, item.id, aspectRatio)));
    }

    setIsGenerating(false);
  };

  const generateImageAsset = async (file: File, prompt: string, id: string, ratio: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'generating' } : a));
    try {
      // This now defaults to Pro Model + 4K size
      const url = await generateMockupImage(file, prompt, ratio);
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'completed', url, is4k: true } : a));
    } catch (error) {
      console.error(error);
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a));
    }
  };

  const generateVideoAsset = async (file: File, description: string, id: string, ratio: '16:9' | '9:16') => {
    try {
      const url = await generateProductVideo(file, description, ratio);
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'completed', url } : a));
    } catch (error) {
      console.error("Video generation failed", error);
      setAssets(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a));
    }
  };

  const handleRetryAsset = async (asset: GeneratedAsset) => {
    if (!image) return;
    
    const aistudio = (window as any).aistudio;
    if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) await aistudio.openSelectKey();
    }
    
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'generating' } : a));

    if (asset.type === 'video') {
       try {
           const veoAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
           const url = await generateProductVideo(image, analysis?.description || asset.prompt, veoAspectRatio);
           setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'completed', url } : a));
       } catch (error) {
           setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'error' } : a));
       }
    } else {
       try {
           const url = await generateMockupImage(image, asset.prompt, aspectRatio);
           setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'completed', url } : a));
       } catch (error) {
           setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'error' } : a));
       }
    }
  };

  const handleDownloadZip = async () => {
    const completedAssets = assets.filter(a => a.status === 'completed');
    if (completedAssets.length === 0) return;

    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      // Parallel fetch of all assets as Blobs. 
      await Promise.all(completedAssets.map(async (asset) => {
          try {
            const response = await fetch(asset.url);
            const blob = await response.blob();
            
            // Clean up ID for filename
            const idSuffix = asset.id.split('-').slice(1).join('-'); 
            const ext = asset.type === 'video' ? 'mp4' : 'png';
            const filename = `etsy-${asset.type}-${idSuffix}.${ext}`;
            
            zip.file(filename, blob);
          } catch (fetchErr) {
            console.error(`Failed to fetch asset ${asset.id}`, fetchErr);
          }
      }));

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `etsy-assets-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Zip generation failed", e);
      alert("Failed to create ZIP file. Please try again.");
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Modal Navigation
  const handleNextAsset = () => {
    if (!selectedAssetId) return;
    const currentIndex = assets.findIndex(a => a.id === selectedAssetId);
    if (currentIndex < assets.length - 1) {
        setSelectedAssetId(assets[currentIndex + 1].id);
    }
  };

  const handlePrevAsset = () => {
    if (!selectedAssetId) return;
    const currentIndex = assets.findIndex(a => a.id === selectedAssetId);
    if (currentIndex > 0) {
        setSelectedAssetId(assets[currentIndex - 1].id);
    }
  };

  // Renderers
  const renderAssetCard = (asset: GeneratedAsset) => {
    const isVideo = asset.type === 'video';
    
    // Determine aspect ratio class for the card container
    let aspectClass = 'aspect-square'; // Default
    if (!isVideo) {
      if (aspectRatio === '16:9') aspectClass = 'aspect-video';
      if (aspectRatio === '9:16') aspectClass = 'aspect-[9/16]';
    }
    
    // Spanning logic
    let spanClass = 'col-span-1';
    if (isVideo) spanClass = 'col-span-2 row-span-2';
    else if (aspectRatio === '16:9') spanClass = 'col-span-2';
    
    return (
      <div 
        key={asset.id} 
        className={`group relative rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-slate-50 cursor-pointer ${spanClass} ${isVideo ? '' : aspectClass}`}
        onClick={() => asset.status === 'completed' && setSelectedAssetId(asset.id)}
      >
        {asset.status === 'completed' ? (
          <>
            {isVideo ? (
              <video src={asset.url} className="w-full h-full object-cover" muted />
            ) : (
              <img src={asset.url} alt={asset.prompt} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
            )}
            
            {/* Hover Actions */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
               <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg transform scale-95 group-hover:scale-100 transition-transform">
                   <ZoomInIcon className="w-4 h-4 text-slate-700" />
                   <span className="text-xs font-bold text-slate-800">View 4K</span>
               </div>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
               <p className="text-white text-xs truncate">{asset.prompt}</p>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center cursor-default">
             {asset.status === 'error' ? (
                <div className="text-red-400">
                   <span className="text-2xl block mb-2">⚠️</span>
                   <p className="text-xs font-bold">Failed</p>
                   <button 
                     onClick={(e) => { e.stopPropagation(); handleRetryAsset(asset); }} 
                     className="mt-2 text-xs text-indigo-600 hover:underline"
                   >
                     Retry
                   </button>
                </div>
             ) : (
                <>
                  <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-slate-500 font-medium animate-pulse">
                     {asset.status === 'pending' ? 'Waiting...' : isVideo ? 'Rendering...' : 'Creating...'}
                  </p>
                </>
             )}
          </div>
        )}
        
        {/* Type Badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none items-start">
            <div className="flex gap-1">
                <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm flex items-center gap-1">
                   {isVideo ? <VideoIcon className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                   {asset.type}
                </div>
                {asset.is4k && (
                   <div className="bg-green-500 text-white px-2 py-1 rounded-md text-[10px] font-bold shadow-sm">
                       4K
                   </div>
                )}
            </div>
            {/* Show video aspect ratio warning if square selected */}
            {isVideo && aspectRatio === '1:1' && (
               <div className="bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded-md text-[9px] font-medium border border-white/20">
                   16:9 Only
               </div>
            )}
        </div>
      </div>
    );
  };

  // Asset Modal Viewer
  const renderAssetModal = () => {
      if (!selectedAssetId) return null;
      const asset = assets.find(a => a.id === selectedAssetId);
      if (!asset) return null;
      
      const isVideo = asset.type === 'video';
      const currentIndex = assets.findIndex(a => a.id === selectedAssetId);
      const hasPrev = currentIndex > 0;
      const hasNext = currentIndex < assets.length - 1;

      return (
          <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn">
              {/* Close Button */}
              <button 
                onClick={() => setSelectedAssetId(null)}
                className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 hover:bg-white/10 p-2 rounded-full transition z-50"
              >
                  <XIcon className="w-6 h-6" />
              </button>

              {/* Navigation Left */}
              {hasPrev && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); handlePrevAsset(); }}
                   className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white bg-black/20 hover:bg-white/10 p-3 rounded-full transition z-50"
                 >
                     <ChevronLeftIcon className="w-8 h-8" />
                 </button>
              )}

              {/* Main Content */}
              <div className="w-full h-full flex items-center justify-center p-4 sm:p-12 relative" onClick={() => setSelectedAssetId(null)}>
                 <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
                    {isVideo ? (
                        <video src={asset.url} controls autoPlay className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
                    ) : (
                        <img src={asset.url} alt={asset.prompt} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                    )}
                 </div>
              </div>

              {/* Navigation Right */}
              {hasNext && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); handleNextAsset(); }}
                   className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white bg-black/20 hover:bg-white/10 p-3 rounded-full transition z-50"
                 >
                     <ChevronRightIcon className="w-8 h-8" />
                 </button>
              )}

              {/* Toolbar */}
              <div className="absolute bottom-6 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 z-50">
                  <div className="text-white text-xs font-medium mr-2 max-w-[200px] truncate">
                      {asset.prompt}
                  </div>
                  <div className="h-4 w-px bg-white/20"></div>
                  <button 
                     onClick={() => handleDownload(asset.url, `etsy-${asset.type}-${Date.now()}.${isVideo ? 'mp4' : 'png'}`)}
                     className="text-white hover:text-green-400 flex items-center gap-1 text-sm font-bold transition"
                  >
                      <DownloadIcon className="w-4 h-4" />
                      Download 4K
                  </button>
                  <button 
                     onClick={() => { setSelectedAssetId(null); handleRetryAsset(asset); }}
                     className="text-white/70 hover:text-white flex items-center gap-1 text-sm font-medium transition"
                  >
                      <RefreshIcon className="w-4 h-4" />
                      Regenerate
                  </button>
              </div>
          </div>
      );
  };

  const completedCount = assets.filter(a => a.status === 'completed').length;

  return (
    <div className="w-full h-[calc(100vh-80px)] flex flex-col lg:flex-row gap-6 overflow-hidden">
      
      {/* Sidebar - Controls */}
      <div className="w-full lg:w-96 flex-shrink-0 bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col overflow-hidden h-full">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <WandIcon className="w-5 h-5 text-indigo-600" />
            Etsy Studio
          </h2>
          <p className="text-xs text-slate-500 mt-1">Listing Optimizer & Visual Creator</p>
        </div>

        <div className="p-5 flex-grow overflow-y-auto space-y-6 custom-scrollbar">
           {/* Upload */}
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">1. Product</label>
              
              {/* Keywords Input */}
              <div className="mb-2">
                  <div className="flex items-center gap-1 mb-1">
                     <TagIcon className="w-3 h-3 text-slate-400" />
                     <span className="text-[10px] text-slate-500 font-bold uppercase">Target Keywords (Optional)</span>
                  </div>
                  <input 
                      type="text" 
                      value={userKeywords}
                      onChange={(e) => setUserKeywords(e.target.value)}
                      placeholder="e.g. boho wedding, rustic decor"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
              </div>

              <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 hover:bg-slate-50 transition text-center cursor-pointer group bg-slate-50/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {image ? (
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded bg-slate-200 overflow-hidden">
                        <img src={URL.createObjectURL(image)} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-left overflow-hidden">
                        <p className="text-sm font-medium text-slate-900 truncate w-40">{image.name}</p>
                        <p className="text-xs text-green-600">Loaded</p>
                      </div>
                   </div>
                ) : (
                  <div className="py-4">
                     <UploadIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                     <p className="text-xs text-slate-500">Upload product image</p>
                  </div>
                )}
              </div>
           </div>

           {/* Analysis Result */}
           {isAnalyzing && (
              <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 p-3 rounded-lg text-sm">
                 <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                 Optimizing listing...
              </div>
           )}

           {analysis && !isAnalyzing && (
             <div className="space-y-6 animate-fadeIn">
                
                {/* Generated Listing Info */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">2. Listing Metadata</label>
                        <button onClick={handleRegenerateMetadata} className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1">
                            <RefreshIcon className="w-3 h-3" /> Refresh Text
                        </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-4 shadow-sm">
                        {/* Title */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] uppercase text-slate-400 font-bold">Title ({analysis.title.length}/125)</span>
                                <button onClick={() => copyToClipboard(analysis.title)} className="text-slate-400 hover:text-indigo-600"><CopyIcon className="w-3 h-3" /></button>
                            </div>
                            <p className="text-xs text-slate-800 leading-snug font-medium border-l-2 border-indigo-500 pl-2">{analysis.title}</p>
                        </div>
                        
                        {/* Tags */}
                        <div>
                             <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] uppercase text-slate-400 font-bold">13 Tags</span>
                                <button onClick={() => copyToClipboard(analysis.tags.join(', '))} className="text-slate-400 hover:text-indigo-600"><CopyIcon className="w-3 h-3" /></button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {analysis.tags.map((tag, i) => (
                                    <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">{tag}</span>
                                ))}
                            </div>
                        </div>

                         {/* Description */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] uppercase text-slate-400 font-bold">Description</span>
                                <button onClick={() => copyToClipboard(analysis.description)} className="text-slate-400 hover:text-indigo-600"><CopyIcon className="w-3 h-3" /></button>
                            </div>
                            <div className="max-h-24 overflow-y-auto custom-scrollbar border border-slate-100 rounded bg-slate-50 p-2">
                                <p className="text-[10px] text-slate-600 whitespace-pre-line leading-relaxed">{analysis.description}</p>
                            </div>
                        </div>

                        {/* SEO Reasoning */}
                        {analysis.seoReasoning && (
                             <div className="bg-indigo-50 p-2 rounded text-[10px] text-indigo-800 italic">
                                💡 {analysis.seoReasoning}
                             </div>
                        )}
                    </div>
                </div>

                {/* Settings */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">3. Visual Settings</label>
                    <div className="grid grid-cols-2 gap-2">
                         {/* Aspect Ratio */}
                        <div className="col-span-2 flex bg-slate-100 p-1 rounded-lg">
                           <button 
                             onClick={() => setAspectRatio('1:1')}
                             className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all ${aspectRatio === '1:1' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                              <SquareIcon className="w-3 h-3" /> Square
                           </button>
                           <button 
                             onClick={() => setAspectRatio('9:16')}
                             className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all ${aspectRatio === '9:16' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                              <PortraitIcon className="w-3 h-3" /> Story
                           </button>
                           <button 
                             onClick={() => setAspectRatio('16:9')}
                             className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all ${aspectRatio === '16:9' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                           >
                              <LandscapeIcon className="w-3 h-3" /> Landscape
                           </button>
                        </div>
                        
                        {/* Thumbnail Mode Toggle */}
                        <div className="col-span-2">
                            <label className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${isThumbnailMode ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                <div className="flex items-center gap-2">
                                    <ImageIcon className={`w-4 h-4 ${isThumbnailMode ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <span className={`text-xs font-medium ${isThumbnailMode ? 'text-indigo-800' : 'text-slate-600'}`}>Thumbnail Booster</span>
                                </div>
                                <input type="checkbox" checked={isThumbnailMode} onChange={() => setIsThumbnailMode(!isThumbnailMode)} className="accent-indigo-600 w-4 h-4" />
                            </label>
                            <p className="text-[10px] text-slate-400 mt-1 px-1">Enhances contrast and vibrancy for click-throughs.</p>
                        </div>
                    </div>
                </div>

                {/* Scenarios Editor */}
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">4. Scenarios ({scenarios.length})</label>
                      <button onClick={handleAddScenario} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-full"><PlusIcon className="w-4 h-4" /></button>
                   </div>
                   <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {scenarios.map((scene, i) => (
                        <div key={i} className="flex gap-2 group">
                           <span className="font-mono text-[10px] text-slate-300 pt-2 w-4 text-center">{i+1}</span>
                           <textarea
                             value={scene}
                             onChange={(e) => handleScenarioChange(i, e.target.value)}
                             rows={2}
                             className="flex-1 text-xs p-2 rounded border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                             placeholder="Enter a scene description..."
                           />
                           <button onClick={() => handleRemoveScenario(i)} className="text-slate-300 hover:text-red-500 self-start mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <TrashIcon className="w-3 h-3" />
                           </button>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           )}
        </div>

        <div className="p-5 border-t border-slate-100 bg-white flex-shrink-0">
           <button
             onClick={handleGenerateAssets}
             disabled={!analysis || isGenerating}
             className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all flex items-center justify-center gap-2
               ${!analysis || isGenerating
                 ? 'bg-slate-300 cursor-not-allowed' 
                 : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99]'
               }`}
           >
             {isGenerating ? (
               <>
                 <RefreshIcon className="w-4 h-4 animate-spin" />
                 Generating...
               </>
             ) : (
               <>
                 <SparklesIcon className="w-4 h-4" />
                 Generate All Assets (4K)
               </>
             )}
           </button>
           <p className="text-[10px] text-center text-slate-400 mt-2">
             Requires paid Google Cloud Project for 4K & Video.
           </p>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-grow flex flex-col bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
         {/* Gallery Header */}
         <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm z-10">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                Gallery <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">{completedCount}</span>
            </h3>
            {completedCount > 0 && (
               <button 
                 onClick={handleDownloadZip}
                 disabled={isZipping}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm border
                   ${isZipping 
                     ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-wait' 
                     : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-indigo-600'
                   }`}
               >
                  {isZipping ? <RefreshIcon className="w-3 h-3 animate-spin" /> : <ArchiveIcon className="w-3 h-3" />}
                  {isZipping ? 'Zipping...' : 'Download ZIP'}
               </button>
            )}
         </div>

         {/* Gallery Grid */}
         <div className="flex-grow overflow-y-auto p-6 scroll-smooth custom-scrollbar">
            {assets.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                  <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                     <ImageIcon className="w-10 h-10" />
                  </div>
                  <p className="text-lg font-medium">Visual Studio Empty</p>
                  <p className="text-sm">Upload an image to start creating mockups, thumbnails, and videos.</p>
               </div>
            ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-min pb-10">
                  {assets.map(renderAssetCard)}
               </div>
            )}
         </div>
      </div>

      {/* Asset Viewer Modal */}
      {renderAssetModal()}

    </div>
  );
};

export default MockupGenerator;