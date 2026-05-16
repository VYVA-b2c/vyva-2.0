import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { AlertTriangle, Clock, Activity, HeartOff, UserMinus } from 'lucide-react';

export const ProblemSlide = () => {
  const image = "https://images.unsplash.com/photo-1706031187542-a6874a7f5fd2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

  const items = [
    { icon: UserMinus, text: "Seniors alone between visits" },
    { icon: AlertTriangle, text: "Missed medications" },
    { icon: Activity, text: "Unnoticed symptoms" },
    { icon: HeartOff, text: "Silent falls" },
    { icon: Clock, text: "Loneliness" },
  ];

  return (
    <SlideLayout>
      <div className="flex h-full gap-12 items-center">
        <div className="flex-1">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-5xl font-bold text-[#8253AB] mb-12 leading-tight"
          >
            Most Risks Happen When No One Is There
          </motion.h2>
          
          <div className="space-y-6 mb-12">
            {items.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * idx }}
                className="flex items-center gap-4 text-2xl text-gray-700"
              >
                <div className="p-3 bg-purple-50 rounded-full text-[#8253AB]">
                  <item.icon size={32} />
                </div>
                {item.text}
              </motion.div>
            ))}
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xl font-medium text-[#8253AB] border-l-4 border-[#FFDF61] pl-6 py-2"
          >
            Home care is strong during the visit. VYVA covers the hours in between.
          </motion.p>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 h-[80%] relative"
        >
          <div className="absolute inset-0 bg-[#8253AB] rounded-3xl opacity-10 translate-x-4 translate-y-4"></div>
          <img 
            src={image} 
            alt="Senior alone" 
            className="w-full h-full object-cover rounded-3xl shadow-xl"
          />
        </motion.div>
      </div>
    </SlideLayout>
  );
};
