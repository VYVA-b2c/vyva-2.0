import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { Monitor, Bell, CalendarCheck, Users } from 'lucide-react';

export const DashboardSlide = () => {
  const image = "https://images.unsplash.com/photo-1630531210902-0673fd470570?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

  const features = [
    { icon: Monitor, text: "Live overview of all seniors (meds, symptoms, falls)" },
    { icon: Bell, text: "Smart alerts (missed doses, inactivity)" },
    { icon: CalendarCheck, text: "Better prepared visits with history logs" },
    { icon: Users, text: "Role-based access for nurses & families" },
  ];

  return (
    <SlideLayout>
      <div className="flex h-full gap-12 items-center">
        <div className="flex-1 space-y-8">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-5xl font-bold text-[#8253AB] leading-tight"
          >
            Your Remote Control Room: The VYVA Caregiver Dashboard
          </motion.h2>

          <div className="space-y-6">
            {features.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="mt-1 text-[#FFDF61]">
                  <item.icon size={28} strokeWidth={3} />
                </div>
                <p className="text-xl text-gray-700 font-medium">{item.text}</p>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-[#8253AB] text-white p-6 rounded-xl shadow-lg text-center text-2xl font-bold"
          >
            “Less blind spots. Less crisis. More proactive care.”
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="flex-1 h-[80%] relative"
        >
           <div className="absolute -inset-4 bg-gray-100 rounded-3xl -z-10 rotate-2"></div>
          <img 
            src={image} 
            alt="Caregiver Dashboard" 
            className="w-full h-full object-cover rounded-xl shadow-2xl border-4 border-white"
          />
        </motion.div>
      </div>
    </SlideLayout>
  );
};
