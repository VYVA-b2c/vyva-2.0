import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { Building2, Phone, Activity } from 'lucide-react';

export const OnboardingSlide = () => {
  const steps = [
    {
      num: "1",
      title: "Set up the agency",
      icon: Building2,
      details: [
        "Choose a small group of seniors",
        "Configure languages & alerts",
        "Invite caregivers to dashboard"
      ]
    },
    {
      num: "2",
      title: "Onboard the Senior",
      icon: Phone,
      details: [
        "Connect via phone or WhatsApp",
        "Short welcome call to set tone",
        "No complex devices or passwords"
      ]
    },
    {
      num: "3",
      title: "Daily use",
      icon: Activity,
      details: [
        "Senior talks naturally to VYVA",
        "Alerts appear in dashboard",
        "Adjust settings anytime"
      ]
    }
  ];

  return (
    <SlideLayout>
      <div className="flex flex-col h-full justify-center">
        <motion.h2 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-bold text-[#8253AB] mb-12 text-center"
        >
          How It Works – Easy Onboarding for Your Team and Seniors
        </motion.h2>

        <div className="grid grid-cols-3 gap-8 relative">
          {/* Connecting Line */}
          <div className="absolute top-12 left-[16%] right-[16%] h-1 bg-gray-200 -z-10" />

          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.2 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-24 h-24 bg-white border-4 border-[#FFDF61] rounded-full flex items-center justify-center text-4xl font-bold text-[#8253AB] mb-6 shadow-sm relative">
                {step.num}
                <div className="absolute -bottom-2 -right-2 bg-[#8253AB] text-white p-2 rounded-full">
                  <step.icon size={20} />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-4">{step.title}</h3>
              
              <ul className="space-y-2 text-gray-600">
                {step.details.map((d, i) => (
                  <li key={i} className="text-lg">{d}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-16 text-center"
        >
          <span className="bg-[#FFDF61] text-[#8253AB] px-8 py-4 rounded-full text-3xl font-bold shadow-lg inline-block transform -rotate-1">
            “Go live in days, not months.”
          </span>
        </motion.div>
      </div>
    </SlideLayout>
  );
};
