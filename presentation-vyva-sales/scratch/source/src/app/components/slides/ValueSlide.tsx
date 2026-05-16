import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { TrendingUp, Heart, ShieldCheck, Award } from 'lucide-react';

export const ValueSlide = () => {
  const benefits = [
    {
      title: "Extend service without extending payroll",
      desc: "Scale your care capacity efficiently.",
      icon: TrendingUp
    },
    {
      title: "Stronger value for seniors & families",
      desc: "Provide peace of mind 24/7.",
      icon: Heart
    },
    {
      title: "Fewer emergencies",
      desc: "Catch issues before they become hospital visits.",
      icon: ShieldCheck
    },
    {
      title: "Clear differentiation",
      desc: "Stand out with innovative tech-enabled care.",
      icon: Award
    }
  ];

  return (
    <SlideLayout>
      <div className="flex flex-col h-full justify-center items-center max-w-6xl mx-auto">
        <motion.h2 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold text-[#8253AB] mb-16 text-center"
        >
          Why Home Care Agencies Choose VYVA
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          {benefits.map((b, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: idx % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-md border-l-8 border-[#FFDF61] flex items-start gap-6"
            >
              <div className="text-[#8253AB]">
                <b.icon size={48} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{b.title}</h3>
                <p className="text-lg text-gray-500">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-16 flex gap-4 justify-center flex-wrap"
        >
          {["Competitive Advantage", "Premium Service", "Tech-Enabled Care"].map((tag, i) => (
            <span key={i} className="px-6 py-2 bg-purple-100 text-[#8253AB] font-bold rounded-full text-xl border border-purple-200">
              {tag}
            </span>
          ))}
        </motion.div>
      </div>
    </SlideLayout>
  );
};
