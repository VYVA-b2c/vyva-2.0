import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { Pill, MessageCircle, BookOpen, Stethoscope, AlertOctagon } from 'lucide-react';

export const SeniorExperienceSlide = () => {
  const features = [
    { 
      icon: Pill, 
      title: "Medication Reminders + Confirmation",
      desc: "Gentle nudges to take pills on time."
    },
    { 
      icon: MessageCircle, 
      title: "Daily Voice Check-ins",
      desc: "Conversations to reduce loneliness."
    },
    { 
      icon: BookOpen, 
      title: "Stories, Music, Quizzes",
      desc: "Cognitive engagement and fun."
    },
    { 
      icon: Stethoscope, 
      title: "Guided Symptom Checker",
      desc: "Help when they 'don't feel well'."
    },
    { 
      icon: AlertOctagon, 
      title: "Fall Detection & Voice Check",
      desc: "Immediate response after a fall."
    },
  ];

  return (
    <SlideLayout>
      <div className="h-full flex flex-col">
        <motion.h2 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold text-[#8253AB] mb-12 text-center"
        >
          How VYVA Supports the Senior Day-to-Day
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-lg border border-purple-50 hover:shadow-xl transition-shadow"
            >
              <div className="w-16 h-16 bg-[#8253AB] rounded-2xl flex items-center justify-center text-white mb-6 shadow-md">
                <feature.icon size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">{feature.title}</h3>
              <p className="text-lg text-gray-500 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
};
