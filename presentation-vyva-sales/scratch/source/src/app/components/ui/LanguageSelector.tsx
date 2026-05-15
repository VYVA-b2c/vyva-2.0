import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

export const LanguageSelector: React.FC = () => {
  const { currentLanguage, setLanguage } = useLanguage();
  const languages = ['EN', 'FR', 'DE', 'ES', 'IT'] as const;
  
  return (
    <div className="flex gap-1.5 items-center">
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`
            text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-all
            ${lang === currentLanguage 
              ? 'bg-[#8253AB] text-white' 
              : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200'}
          `}
        >
          {lang}
        </button>
      ))}
    </div>
  );
};