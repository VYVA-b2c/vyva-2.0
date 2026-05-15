import React from 'react';
import { LanguageSelector } from './ui/LanguageSelector';
import vyvaLogo from 'figma:asset/0fc0cf3fa2c054a056945e2c5738efe1add32e3e.png';

interface SlideLayoutProps {
  children: React.ReactNode;
  title?: string;
  hideLogo?: boolean;
  hideFooter?: boolean;
  className?: string;
}

export const SlideLayout: React.FC<SlideLayoutProps> = ({ 
  children, 
  title, 
  hideLogo = false, 
  hideFooter = false,
  className = "" 
}) => {
  return (
    <div className={`w-full h-full p-8 flex flex-col relative ${className}`}>
      {/* Header */}
      {!hideLogo && (
        <div className="absolute top-6 left-8 w-20">
          <img src={vyvaLogo} alt="VYVA" className="w-full object-contain" />
        </div>
      )}
      
      {/* Language Selector - Top Right */}
      <div className="absolute top-6 right-8">
        <LanguageSelector />
      </div>
      
      {/* Title */}
      {title && (
        <h2 className="text-3xl font-bold text-[#8253AB] mt-4 mb-6">{title}</h2>
      )}

      {/* Content */}
      <div className="flex-1 relative z-10 min-h-0">
        {children}
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className="absolute bottom-4 left-8 right-8 flex justify-between items-center border-t border-gray-100 pt-3">
          {/* Footer text removed */}
        </div>
      )}
    </div>
  );
};