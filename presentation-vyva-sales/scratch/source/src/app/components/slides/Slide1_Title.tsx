import React from 'react';
import { SlideLayout } from '../SlideLayout';
import vyvaLogo from 'figma:asset/0fc0cf3fa2c054a056945e2c5738efe1add32e3e.png';
import { LanguageSelector } from '../ui/LanguageSelector';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: 'Extending Your Care Beyond the Visit',
    subtitle: 'AI Voice Companion & Caregiver Dashboard for Home Care Agencies',
    presentedBy: 'Presented By'
  },
  FR: {
    title: 'Prolonger Vos Soins Au-Delà de la Visite',
    subtitle: 'Compagnon Vocal IA & Tableau de Bord pour Agences de Soins à Domicile',
    presentedBy: 'Présenté Par'
  },
  DE: {
    title: 'Ihre Pflege Über den Besuch Hinaus Erweitern',
    subtitle: 'KI-Sprachbegleiter & Pflegekraft-Dashboard für häusliche Pflegedienste',
    presentedBy: 'Präsentiert Von'
  },
  ES: {
    title: 'Extendiendo Su Cuidado Más Allá de la Visita',
    subtitle: 'Compañero de Voz IA & Panel de Control para Agencias de Cuidado en el Hogar',
    presentedBy: 'Presentado Por'
  },
  IT: {
    title: 'Estendere la Vostra Assistenza Oltre la Visita',
    subtitle: 'Compagno Vocale IA & Dashboard per Agenzie di Assistenza Domiciliare',
    presentedBy: 'Presentato Da'
  }
};

export const Slide1_Title: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <div className="w-full h-full flex items-center justify-center relative bg-gradient-to-br from-white to-purple-50">
      <div className="text-center max-w-4xl px-8">
        <div className="mb-10 flex justify-center">
            <img src={vyvaLogo} alt="VYVA Logo" className="h-20 object-contain" />
        </div>
        
        <h1 className="text-5xl font-bold text-[#8253AB] mb-5 leading-tight">
          {t.title}
        </h1>
        
        <div className="w-28 h-2 bg-[#FFDF61] mx-auto mb-6 rounded-full"></div>
        
        <p className="text-xl text-gray-600 font-light mb-12">
          {t.subtitle}
        </p>
        
        <div className="absolute bottom-10 left-0 right-0 px-8 flex justify-center items-end">
          <div className="text-center">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">{t.presentedBy}</p>
            <p className="text-lg font-bold text-gray-700">MOKA DIGITECK, S.L.</p>
          </div>
        </div>
      </div>

      {/* Language Selector - Top Right */}
      <div className="absolute top-10 right-10 z-20">
        <LanguageSelector />
      </div>
      
      {/* Decorative circle */}
      <div className="absolute top-0 right-0 w-56 h-56 bg-[#8253AB]/5 rounded-bl-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#FFDF61]/10 rounded-tr-full pointer-events-none" />
    </div>
  );
};