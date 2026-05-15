import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';

export const TitleSlide = () => {
  return (
    <SlideLayout showLanguageSelector={true} footerText="MOKA DIGITECK, S.L.">
      <div className="flex flex-col justify-center h-full max-w-4xl mx-auto text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl font-bold text-[#8253AB] mb-8 leading-tight"
        >
          VYVA: Extending Your Care Beyond the Visit
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl text-gray-600 font-light mb-12"
        >
          AI Voice Companion & Caregiver Dashboard for Home Care Agencies
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-gray-500 font-medium"
        >
          Presented by MOKA DIGITECK, S.L.
        </motion.div>
      </div>
    </SlideLayout>
  );
};
