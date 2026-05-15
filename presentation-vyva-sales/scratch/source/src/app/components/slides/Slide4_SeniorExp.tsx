import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { Mic, Music, Pill, Thermometer, UserCheck, Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import slideImage from 'figma:asset/43ece571d97b3cc52e42f97e43f30d4eafe1f97a.png';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: 'How VYVA Supports the Senior Day-to-Day',
    voiceActive: 'Voice Active',
    greeting: 'Good morning, Maria! Just checking in. Did you sleep well?',
    feature1Title: 'Medication Reminders',
    feature1Desc: 'Timely prompts + confirmation. "It\'s time for your blue pill."',
    feature2Title: 'Daily Voice Check-ins',
    feature2Desc: 'Natural conversation to combat loneliness and assess mood.',
    feature3Title: 'Engagement & Fun',
    feature3Desc: 'Stories, music, quizzes, and memory games tailored to them.',
    feature4Title: 'Health Support',
    feature4Desc: 'Guided symptom checker when they "don\'t feel well". Fall detection.',
    feature5Title: 'Brain Coach',
    feature5Desc: 'Cognitive exercises and memory training to keep minds sharp.'
  },
  FR: {
    title: 'Comment VYVA Soutient le Senior au Quotidien',
    voiceActive: 'Voix Active',
    greeting: 'Bonjour Maria ! Je prends de vos nouvelles. Avez-vous bien dormi ?',
    feature1Title: 'Rappels de Médicaments',
    feature1Desc: 'Rappels ponctuels + confirmation. "Il est temps de prendre votre pilule bleue."',
    feature2Title: 'Contrôles Vocaux Quotidiens',
    feature2Desc: 'Conversation naturelle pour combattre la solitude et évaluer l\'humeur.',
    feature3Title: 'Engagement & Divertissement',
    feature3Desc: 'Histoires, musique, quiz et jeux de mémoire adaptés à eux.',
    feature4Title: 'Soutien Santé',
    feature4Desc: 'Vérificateur de symptômes guidé quand ils "ne se sentent pas bien". Détection de chute.',
    feature5Title: 'Coach Cérébral',
    feature5Desc: 'Exercices cognitifs et entraînement de la mémoire pour garder l\'esprit vif.'
  },
  DE: {
    title: 'Wie VYVA Senioren im Alltag Unterstützt',
    voiceActive: 'Stimme Aktiv',
    greeting: 'Guten Morgen, Maria! Ich schaue nur vorbei. Haben Sie gut geschlafen?',
    feature1Title: 'Medikamentenerinnerungen',
    feature1Desc: 'Rechtzeitige Erinnerungen + Bestätigung. "Es ist Zeit für Ihre blaue Pille."',
    feature2Title: 'Tägliche Sprach-Check-ins',
    feature2Desc: 'Natürliche Konversation gegen Einsamkeit und zur Stimmungsbeurteilung.',
    feature3Title: 'Engagement & Spaß',
    feature3Desc: 'Geschichten, Musik, Quizze und Gedächtnisspiele auf sie zugeschnitten.',
    feature4Title: 'Gesundheitsunterstützung',
    feature4Desc: 'Geführter Symptom-Checker wenn sie sich "unwohl fühlen". Sturzerkennung.',
    feature5Title: 'Gehirn-Coach',
    feature5Desc: 'Kognitive Übungen und Gedächtnistraining um den Geist scharf zu halten.'
  },
  ES: {
    title: 'Cómo VYVA Apoya al Adulto Mayor Día a Día',
    voiceActive: 'Voz Activa',
    greeting: '¡Buenos días, María! Solo verifico. ¿Dormiste bien?',
    feature1Title: 'Recordatorios de Medicamentos',
    feature1Desc: 'Avisos oportunos + confirmación. "Es hora de tu pastilla azul."',
    feature2Title: 'Chequeos de Voz Diarios',
    feature2Desc: 'Conversación natural para combatir la soledad y evaluar el estado de ánimo.',
    feature3Title: 'Compromiso y Diversión',
    feature3Desc: 'Historias, música, cuestionarios y juegos de memoria adaptados a ellos.',
    feature4Title: 'Apoyo de Salud',
    feature4Desc: 'Verificador de síntomas guiado cuando "no se sienten bien". Detección de caídas.',
    feature5Title: 'Entrenador Cerebral',
    feature5Desc: 'Ejercicios cognitivos y entrenamiento de memoria para mantener mentes ágiles.'
  },
  IT: {
    title: 'Come VYVA Supporta l\'Anziano Giorno per Giorno',
    voiceActive: 'Voce Attiva',
    greeting: 'Buongiorno, Maria! Solo un controllo. Hai dormito bene?',
    feature1Title: 'Promemoria Farmaci',
    feature1Desc: 'Avvisi tempestivi + conferma. "È ora della tua pillola blu."',
    feature2Title: 'Check-in Vocali Giornalieri',
    feature2Desc: 'Conversazione naturale per combattere la solitudine e valutare l\'umore.',
    feature3Title: 'Coinvolgimento e Divertimento',
    feature3Desc: 'Storie, musica, quiz e giochi di memoria su misura per loro.',
    feature4Title: 'Supporto Sanitario',
    feature4Desc: 'Controllo sintomi guidato quando "non si sentono bene". Rilevamento cadute.',
    feature5Title: 'Coach Cerebrale',
    feature5Desc: 'Esercizi cognitivi e allenamento della memoria per mantenere menti acute.'
  }
};

export const Slide4_SeniorExp: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title={t.title} hideLogo>
      <div className="h-full grid grid-cols-12 gap-6">
        {/* Left Column - Visual */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="col-span-5 relative"
        >
            <motion.div 
              initial={{ opacity: 0, rotate: -6 }}
              animate={{ opacity: 1, rotate: -3 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute inset-0 bg-[#8253AB]/5 rounded-3xl -rotate-3 transform"
            ></motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3, type: "spring", stiffness: 100 }}
              className="relative h-full rounded-3xl overflow-hidden shadow-2xl border-4 border-white"
            >
                <img 
                    src={slideImage}
                    alt="Senior using smartphone" 
                    className="w-full h-full object-cover"
                />
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5"
                >
                    <div className="flex items-center gap-2 text-white mb-1.5">
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                          className="w-2 h-2 bg-green-400 rounded-full"
                        ></motion.div>
                        <span className="font-mono text-sm opacity-90">{t.voiceActive}</span>
                    </div>
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2, duration: 0.8 }}
                      className="text-white text-lg font-medium italic"
                    >
                      {t.greeting}
                    </motion.p>
                </motion.div>
            </motion.div>
        </motion.div>

        {/* Right Column - Features */}
        <div className="col-span-7 flex flex-col justify-center gap-4">
            
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4, type: "spring", stiffness: 100 }}
              whileHover={{ scale: 1.02, x: -5 }}
              className="flex items-center gap-4 p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#8253AB]/30 hover:shadow-lg transition-all"
            >
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0"
                >
                    <Pill size={28} />
                </motion.div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{t.feature1Title}</h3>
                    <p className="text-gray-500 text-sm">{t.feature1Desc}</p>
                </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6, type: "spring", stiffness: 100 }}
              whileHover={{ scale: 1.02, x: -5 }}
              className="flex items-center gap-4 p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#8253AB]/30 hover:shadow-lg transition-all"
            >
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center shrink-0"
                >
                    <Mic size={28} />
                </motion.div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{t.feature2Title}</h3>
                    <p className="text-gray-500 text-sm">{t.feature2Desc}</p>
                </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8, type: "spring", stiffness: 100 }}
              whileHover={{ scale: 1.02, x: -5 }}
              className="flex items-center gap-4 p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#8253AB]/30 hover:shadow-lg transition-all"
            >
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center shrink-0"
                >
                    <Music size={28} />
                </motion.div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{t.feature3Title}</h3>
                    <p className="text-gray-500 text-sm">{t.feature3Desc}</p>
                </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.0, type: "spring", stiffness: 100 }}
              whileHover={{ scale: 1.02, x: -5 }}
              className="flex items-center gap-4 p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#8253AB]/30 hover:shadow-lg transition-all"
            >
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0"
                >
                    <Thermometer size={28} />
                </motion.div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{t.feature4Title}</h3>
                    <p className="text-gray-500 text-sm">{t.feature4Desc}</p>
                </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.2, type: "spring", stiffness: 100 }}
              whileHover={{ scale: 1.02, x: -5 }}
              className="flex items-center gap-4 p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-[#8253AB]/30 hover:shadow-lg transition-all"
            >
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0"
                >
                    <Brain size={28} />
                </motion.div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">{t.feature5Title}</h3>
                    <p className="text-gray-500 text-sm">{t.feature5Desc}</p>
                </div>
            </motion.div>

        </div>
      </div>
    </SlideLayout>
  );
};