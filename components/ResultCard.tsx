
import React, { useState } from 'react';
import { EtsyListingResponse } from '../types';
import { CopyIcon, CheckIcon, TagIcon, RefreshIcon } from './Icons';

interface ResultCardProps {
  data: EtsyListingResponse;
  onReset: () => void;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <CheckIcon className="w-5 h-5 text-green-600" /> : <CopyIcon className="w-5 h-5" />}
    </button>
  );
};

const ResultCard: React.FC<ResultCardProps> = ({ data, onReset }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">

      {/* Header Actions */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Your Optimized Listing</h2>
          <p className="text-sm text-slate-500">Review and edit before publishing to Etsy.</p>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
        >
          <RefreshIcon className="w-4 h-4" />
          Start Over
        </button>
      </div>

      {/* SEO Title */}
      <div className="bg-white rounded-xl shadow-lg border-l-4 border-orange-500 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-bold text-orange-600 uppercase tracking-wide">SEO Title (140 char limit)</h3>
            <CopyButton text={data.title} />
          </div>
          <p className="text-lg font-medium text-slate-900 leading-snug">{data.title}</p>
          <p className="mt-2 text-xs text-slate-400 text-right">{data.title.length} characters</p>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
            <TagIcon className="w-4 h-4" />
            13 SEO Tags
          </h3>
          <CopyButton text={data.tags.join(',')} />
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-2">
            {data.tags.map((tag, idx) => (
              <span key={idx} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full text-sm font-medium border border-slate-200">
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            *Tip: Copy these individually into your Etsy listing manager.
          </p>
        </div>
      </div>

      {/* Description & Attributes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Description */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Listing Description</h3>
            <CopyButton text={data.description} />
          </div>
          <div className="p-6 flex-grow">
            <div className="prose prose-sm prose-slate max-w-none whitespace-pre-line text-slate-700">
              {data.description}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Strategy */}
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5">
            <h4 className="font-bold text-slate-800 mb-2 text-sm">Category Path</h4>
            <p className="text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
              {data.categoryPath}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5">
            <h4 className="font-bold text-slate-800 mb-2 text-sm">Price Estimate</h4>
            <p className="text-2xl font-bold text-green-600">
              {data.priceSuggestion}
            </p>
            <p className="text-xs text-slate-400 mt-1">Based on market trends</p>
          </div>

          <div className="bg-indigo-50 rounded-xl shadow-md border border-indigo-100 p-5">
            <h4 className="font-bold text-indigo-900 mb-2 text-sm">SEO Reasoning</h4>
            <p className="text-sm text-indigo-800 leading-relaxed">
              {data.seoReasoning}
            </p>
          </div>

          {data.attributes && Object.keys(data.attributes).length > 0 && (
            <div className="bg-white rounded-xl shadow-md border border-slate-200 p-5">
              <h4 className="font-bold text-slate-800 mb-2 text-sm">Detected Attributes</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                {Object.entries(data.attributes).map(([key, value]) => (
                  <li key={key} className="flex justify-between border-b border-slate-50 last:border-0 py-1">
                    <span className="capitalize text-slate-400">{key}:</span>
                    <span className="font-medium">{value as string}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
