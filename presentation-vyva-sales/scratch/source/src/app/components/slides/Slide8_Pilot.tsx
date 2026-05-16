import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { Mail, Globe, Building2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: "Let's Build Better Care Together",
    subtitle: "Your expertise. Our AI. Thousands of seniors supported.",
    contactHeading: "Contact",
    emailLabel: "Email",
    email: "partnerships@mokadigital.net",
    websiteLabel: "Website",
    website: "vyva.life",
    companyName: "VYVA Health",
    companyLegal: "MOKA DIGITECK, S.L.",
    companyTagline: "Creators of VYVA",
    equation: {
      seniors: "Seniors",
      careAgency: "Care Agency",
      ai: "AI Companion",
      result: "Better Care"
    }
  },
  FR: {
    title: "Construisons Ensemble de Meilleurs Soins",
    subtitle: "Votre expertise. Notre IA. Des milliers de seniors accompagnés.",
    contactHeading: "Contact",
    emailLabel: "Email",
    email: "partnerships@mokadigital.net",
    websiteLabel: "Site Web",
    website: "vyva.life",
    companyName: "VYVA Health",
    companyLegal: "MOKA DIGITECK, S.L.",
    companyTagline: "Créateurs de VYVA",
    equation: {
      seniors: "Seniors",
      careAgency: "Agence de Soins",
      ai: "Compagnon IA",
      result: "Meilleurs Soins"
    }
  },
  DE: {
    title: "Gemeinsam Bessere Pflege Aufbauen",
    subtitle: "Ihre Expertise. Unsere KI. Tausende betreute Senioren.",
    contactHeading: "Kontakt",
    emailLabel: "E-Mail",
    email: "partnerships@mokadigital.net",
    websiteLabel: "Webseite",
    website: "vyva.life",
    companyName: "VYVA Health",
    companyLegal: "MOKA DIGITECK, S.L.",
    companyTagline: "Entwickler von VYVA",
    equation: {
      seniors: "Senioren",
      careAgency: "Pflegeagentur",
      ai: "KI-Begleiter",
      result: "Bessere Pflege"
    }
  },
  ES: {
    title: "Construyamos Mejor Atención Juntos",
    subtitle: "Su experiencia. Nuestra IA. Miles de seniors atendidos.",
    contactHeading: "Contacto",
    emailLabel: "Email",
    email: "partnerships@mokadigital.net",
    websiteLabel: "Sitio Web",
    website: "vyva.life",
    companyName: "VYVA Health",
    companyLegal: "MOKA DIGITECK, S.L.",
    companyTagline: "Creadores de VYVA",
    equation: {
      seniors: "Seniors",
      careAgency: "Agencia de Atención",
      ai: "Compañero IA",
      result: "Mejor Atención"
    }
  },
  IT: {
    title: "Costruiamo Insieme un'Assistenza Migliore",
    subtitle: "La vostra esperienza. La nostra IA. Migliaia di anziani assistiti.",
    contactHeading: "Contatto",
    emailLabel: "Email",
    email: "partnerships@mokadigital.net",
    websiteLabel: "Sito Web",
    website: "vyva.life",
    companyName: "VYVA Health",
    companyLegal: "MOKA DIGITECK, S.L.",
    companyTagline: "Creatori di VYVA",
    equation: {
      seniors: "Anziani",
      careAgency: "Agenzia di Assistenza",
      ai: "Compagno IA",
      result: "Assistenza Migliore"
    }
  }
};

export const Slide8_Pilot: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title="" hideFooter hideLogo>
      <div className="h-full w-full relative" style={{ background: "linear-gradient(150deg, #8253AB 0%, #6E11B0 50%, #8200DB 100%)" }}>
        
        {/* Main Content Container */}
        <div className="absolute inset-0 flex flex-col gap-6 items-start px-12 py-10">
          
          {/* Top Section - Heading, Subtitle, and Contact Card */}
          <div className="flex flex-col gap-6 w-full max-w-[900px]">
            
            {/* Heading */}
            <h1 className="text-white text-5xl leading-tight">
              {t.title}
            </h1>
            
            {/* Subtitle */}
            <p className="text-white/90 text-xl">
              {t.subtitle}
            </p>
            
            {/* Contact Card */}
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-[900px]">
              <h2 className="text-gray-900 text-2xl mb-5">{t.contactHeading}</h2>
              
              <div className="flex items-start justify-between">
                {/* Left Column - Email and Website */}
                <div className="flex flex-col gap-4 flex-1">
                  {/* Email */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Mail size={20} className="text-[#9810FA]" />
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">{t.emailLabel}</div>
                      <div className="text-gray-900">{t.email}</div>
                    </div>
                  </div>
                  
                  {/* Website */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Globe size={20} className="text-[#D08700]" />
                    </div>
                    <div>
                      <div className="text-gray-600 text-sm">{t.websiteLabel}</div>
                      <div className="text-gray-900">{t.website}</div>
                    </div>
                  </div>
                </div>
                
                {/* Right Column - Company Info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Building2 size={20} className="text-[#F54900]" />
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">{t.companyName}</div>
                    <div className="text-gray-900 font-medium">{t.companyLegal}</div>
                    <div className="text-gray-600 text-sm">{t.companyTagline}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Bottom Section - Emoji Equation */}
          <div className="flex items-center justify-center gap-6 w-full max-w-[900px] mt-4">
            {/* Seniors */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl">👵</div>
              <div className="text-white/80 text-sm">{t.equation.seniors}</div>
            </div>
            
            <div className="text-white/60 text-4xl">+</div>
            
            {/* Care Agency */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl">🏥</div>
              <div className="text-white/80 text-sm">{t.equation.careAgency}</div>
            </div>
            
            <div className="text-white/60 text-4xl">+</div>
            
            {/* AI Companion */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl">🤖</div>
              <div className="text-white/80 text-sm">{t.equation.ai}</div>
            </div>
            
            <div className="text-white/60 text-4xl">=</div>
            
            {/* Better Care */}
            <div className="flex flex-col items-center gap-2">
              <div className="text-5xl">💚</div>
              <div className="text-white/80 text-sm">{t.equation.result}</div>
            </div>
          </div>
          
        </div>
      </div>
    </SlideLayout>
  );
};