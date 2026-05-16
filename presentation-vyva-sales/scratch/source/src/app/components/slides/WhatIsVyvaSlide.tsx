import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { Smartphone, Brain, Activity, ShieldAlert } from 'lucide-react';

export const WhatIsVyvaSlide = () => {
  const image = "https://images.unsplash.com/photo-1706806594795-61ddc51116ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

  const capabilities = [
    { icon: Smartphone, text: "Medication Management" },
    { icon: Brain, text: "Companionship & Brain Games" },
    { icon: Activity, text: "Symptom Checking" },
    { icon: ShieldAlert, text: "Fall Detection & Safety Alerts" },
  ];

  return (
    <SlideLayout>
      <div className="flex h-full gap-12 items-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 h-[85%] relative order-2 lg:order-1"
        >
           <div className="absolute inset-0 bg-[#FFDF61] rounded-3xl opacity-20 -translate-x-4 translate-y-4"></div>
          <img 
            src={image} 
            alt="Senior with smartphone" 
            className="w-full h-full object-cover rounded-3xl shadow-xl"
          />
        </motion.div>

        <div className="flex-1 order-1 lg:order-2">
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold text-[#8253AB] mb-6 leading-tight"
          >
            VYVA – Your Digital Companion for Every Senior
          </motion.h2>

          <motion.ul 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="list-disc pl-6 mb-8 text-xl text-gray-600 space-y-2"
          >
            <li>AI voice companion via phone, smartphone, or WhatsApp</li>
            <li>Built for solo seniors</li>
            <li>Works alongside caregivers, not instead of them</li>
          </motion.ul>

          <div className="grid grid-cols-1 gap-4 mb-10">
            {capabilities.map((cap, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (idx * 0.1) }}
                className="bg-white border border-gray-100 shadow-sm p-4 rounded-xl flex items-center gap-4"
              >
                 <div className="bg-[#FFDF61] p-2 rounded-lg text-[#8253AB]">
                    <cap.icon size={24} />
                 </div>
                 <span className="text-lg font-semibold text-gray-700">{cap.text}</span>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-3xl font-bold text-[#8253AB] bg-purple-50 p-6 rounded-xl text-center"
          >
            “24/7 presence without 24/7 staffing.”
          </motion.div>
        </div>
      </div>
    </SlideLayout>
  );
};
