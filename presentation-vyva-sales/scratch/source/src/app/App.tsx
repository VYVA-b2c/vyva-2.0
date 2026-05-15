import React from 'react';
import { Deck } from './components/Deck';
import { LanguageProvider } from './contexts/LanguageContext';
import { Slide1_Title } from './components/slides/Slide1_Title';
import { Slide2_Problem } from './components/slides/Slide2_Problem';
import { Slide3_WhatIs } from './components/slides/Slide3_WhatIs';
import { Slide4_SeniorExp } from './components/slides/Slide4_SeniorExp';
import { Slide5_Dashboard } from './components/slides/Slide5_Dashboard';
import { Slide_CareProvider } from './components/slides/Slide_CareProvider';
import { Slide6_Onboarding } from './components/slides/Slide6_Onboarding';
import { Slide_Collaboration } from './components/slides/Slide_Collaboration';
import { Slide7_Value } from './components/slides/Slide7_Value';
import { Slide8_Pilot } from './components/slides/Slide8_Pilot';

const App: React.FC = () => {
  const slides = [
    Slide1_Title,
    Slide2_Problem,
    Slide4_SeniorExp,
    Slide3_WhatIs,
    Slide5_Dashboard,
    Slide_CareProvider,
    Slide6_Onboarding,
    Slide_Collaboration,
    Slide7_Value,
    Slide8_Pilot,
  ];

  return (
    <LanguageProvider>
      <Deck slides={slides} />
    </LanguageProvider>
  );
};

export default App;