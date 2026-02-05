import React, { useState } from 'react';
import { UserInput } from '../types';
import { SparklesIcon, UploadIcon, InfoIcon, TagIcon } from './Icons';

interface ListingFormProps {
  onSubmit: (data: UserInput) => void;
  isLoading: boolean;
}

const ListingForm: React.FC<ListingFormProps> = ({ onSubmit, isLoading }) => {
  const [formData, setFormData] = useState<UserInput>({
    productName: '',
    productDescription: '',
    materials: '',
    targetAudience: '',
    userKeywords: '',
    image: null
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, image: e.target.files![0] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-orange-50 p-6 border-b border-orange-100">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <SparklesIcon className="text-orange-600" />
          Create Your Listing
        </h2>
        <p className="text-slate-600 mt-2">
          Tell us about your item, and our AI will craft the perfect Etsy SEO content for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Product Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Product Name *
          </label>
          <input
            type="text"
            name="productName"
            required
            value={formData.productName}
            onChange={handleChange}
            placeholder="e.g., Handmade Ceramic Mug"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
          />
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Product Image (Optional but Recommended)
          </label>
          <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 hover:bg-slate-50 transition text-center cursor-pointer group">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center">
              {formData.image ? (
                <div className="text-green-600 font-medium flex items-center gap-2">
                   <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-100 mb-2 border">
                      <img src={URL.createObjectURL(formData.image)} alt="Preview" className="w-full h-full object-cover" />
                   </div>
                   <span className="text-sm">{formData.image.name}</span>
                </div>
              ) : (
                <>
                  <UploadIcon className="w-8 h-8 text-slate-400 group-hover:text-orange-500 mb-2 transition" />
                  <p className="text-sm text-slate-500">
                    <span className="text-orange-600 font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 10MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Rough Description *
          </label>
          <textarea
            name="productDescription"
            required
            value={formData.productDescription}
            onChange={handleChange}
            placeholder="Describe your item roughly. What is it? What makes it special? Don't worry about formatting."
            rows={4}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition resize-y"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Materials */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Materials Used
            </label>
            <input
              type="text"
              name="materials"
              value={formData.materials}
              onChange={handleChange}
              placeholder="e.g., Sterling Silver, Clay, Cotton"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
            />
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Target Audience
            </label>
            <input
              type="text"
              name="targetAudience"
              value={formData.targetAudience}
              onChange={handleChange}
              placeholder="e.g., Moms, Minimalists, Gamers"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
            />
          </div>
        </div>

        {/* User Keywords */}
        <div>
           <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
             <TagIcon className="w-4 h-4 text-orange-500" />
             Your Target Keywords (Optional)
           </label>
           <input
             type="text"
             name="userKeywords"
             value={formData.userKeywords}
             onChange={handleChange}
             placeholder="e.g., rustic wedding, boho decor (comma separated)"
             className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
           />
           <p className="text-xs text-slate-500 mt-1">
             We will mix your keywords with AI-suggested high-traffic tags to create the perfect balance.
           </p>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-sm text-blue-800">
          <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>
            The more details you provide, the better the AI can optimize for Etsy's search algorithm (SEO). Uploading a photo helps the AI see colors, textures, and style!
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 rounded-lg font-bold text-lg text-white shadow-md transition-all 
            ${isLoading 
              ? 'bg-slate-400 cursor-not-allowed' 
              : 'bg-orange-600 hover:bg-orange-700 hover:shadow-lg active:scale-[0.99]'
            }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Magic...
            </span>
          ) : (
            'Generate Listing'
          )}
        </button>
      </form>
    </div>
  );
};

export default ListingForm;