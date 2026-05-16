import React, { createContext, useContext, useState } from 'react';

type Language = 'EN' | 'FR' | 'DE' | 'ES' | 'IT';

interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialLanguage =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('lang') as Language | null)
      : null;
  const [currentLanguage, setCurrentLanguage] = useState<Language>(initialLanguage || 'EN');

  const setLanguage = (lang: Language) => {
    setCurrentLanguage(lang);
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
