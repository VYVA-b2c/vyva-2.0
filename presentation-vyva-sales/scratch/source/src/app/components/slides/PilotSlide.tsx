import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { Play, CheckCircle, BarChart, Rocket } from 'lucide-react';

export const PilotSlide = () => {
  const steps = [
    { icon: CheckCircle, text: "Select pilot seniors" },
    { icon: Play, text: "Onboard seniors & staff" },
    { icon: BarChart, text: "Run 8–12 week pilot" },
    { icon: Rocket, text: "Measure impact & scale" },
  ];

  return (
    <SlideLayout showLanguageSelector={true}>
      <div className="flex flex-col h-full justify-center items-center text-center">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-5xl font-bold text-[#8253AB] mb-16"
        >
          Pilot VYVA With Your Seniors
        </motion.h2>

        <div className="flex justify-between items-center w-full max-w-5xl mb-20 relative">
           {/* Line */}
           <div className="absolute top-1/2 left-0 right-0 h-2 bg-purple-100 -z-10 -translate-y-1/2" />
           
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.2 }}
              className="bg-white p-6 rounded-xl flex flex-col items-center gap-4 shadow-sm w-56"
            >
              <div className="w-20 h-20 bg-[#8253AB] text-white rounded-full flex items-center justify-center shadow-md">
                <step.icon size={32} />
              </div>
              <span className="text-xl font-bold text-gray-700">{step.text}</span>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-[#FFDF61] text-[#8253AB] p-8 rounded-2xl shadow-xl max-w-3xl w-full"
        >
          <h3 className="text-3xl font-bold mb-4">Let’s choose a small group of your seniors and prove the value in real life.</h3>
          <div className="text-xl font-medium opacity-80">Contact us to start your pilot today.</div>
        </motion.div>
      </div>
    </SlideLayout>
  );
};
