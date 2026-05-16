import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { AlertCircle, EyeOff, UserMinus } from 'lucide-react';
import { motion } from 'motion/react';
import slideImage from 'figma:asset/ff16b97be98646d3f3f930e34b73ac7378b248b7.png';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: 'Most Risks Happen When No One Is There',
    problem1Title: 'Seniors Alone Between Visits',
    problem1Desc: 'Hours of isolation where anxiety and confusion can set in without support.',
    problem2Title: 'Missed Medications',
    problem2Desc: 'Complex schedules often lead to errors or skipped doses when unsupervised.',
    problem3Title: 'Unnoticed Symptoms',
    problem3Desc: 'Health declines that aren\'t caught until the next scheduled visit.',
    imageQuote: '"Who is watching when the caregiver leaves?"',
    bannerLine1: 'Home care is strong during the visit.',
    bannerLine2: 'VYVA covers the hours in between.'
  },
  FR: {
    title: 'La Plupart des Risques Surviennent Quand Personne n\'Est Là',
    problem1Title: 'Seniors Seuls Entre les Visites',
    problem1Desc: 'Des heures d\'isolement où l\'anxiété et la confusion peuvent s\'installer sans soutien.',
    problem2Title: 'Médicaments Oubliés',
    problem2Desc: 'Des horaires complexes entraînent souvent des erreurs ou des doses oubliées sans supervision.',
    problem3Title: 'Symptômes Non Détectés',
    problem3Desc: 'Détériorations de santé non détectées jusqu\'à la prochaine visite programmée.',
    imageQuote: '"Qui surveille quand le soignant part ?"',
    bannerLine1: 'Les soins à domicile sont efficaces pendant la visite.',
    bannerLine2: 'VYVA couvre les heures intermédiaires.'
  },
  DE: {
    title: 'Die Meisten Risiken Passieren, Wenn Niemand Da Ist',
    problem1Title: 'Senioren Allein Zwischen Besuchen',
    problem1Desc: 'Stunden der Isolation, in denen Angst und Verwirrung ohne Unterstützung auftreten können.',
    problem2Title: 'Verpasste Medikamente',
    problem2Desc: 'Komplexe Zeitpläne führen oft zu Fehlern oder übersprungenen Dosen ohne Aufsicht.',
    problem3Title: 'Unbemerkte Symptome',
    problem3Desc: 'Gesundheitliche Verschlechterungen, die erst beim nächsten geplanten Besuch bemerkt werden.',
    imageQuote: '"Wer passt auf, wenn die Pflegekraft geht?"',
    bannerLine1: 'Häusliche Pflege ist während des Besuchs stark.',
    bannerLine2: 'VYVA deckt die Stunden dazwischen ab.'
  },
  ES: {
    title: 'La Mayoría de los Riesgos Ocurren Cuando No Hay Nadie',
    problem1Title: 'Adultos Mayores Solos Entre Visitas',
    problem1Desc: 'Horas de aislamiento donde la ansiedad y confusión pueden aparecer sin apoyo.',
    problem2Title: 'Medicamentos Olvidados',
    problem2Desc: 'Horarios complejos a menudo llevan a errores o dosis omitidas sin supervisión.',
    problem3Title: 'Síntomas No Detectados',
    problem3Desc: 'Deterioros de salud que no se detectan hasta la próxima visita programada.',
    imageQuote: '"¿Quién vigila cuando el cuidador se va?"',
    bannerLine1: 'El cuidado en casa es fuerte durante la visita.',
    bannerLine2: 'VYVA cubre las horas intermedias.'
  },
  IT: {
    title: 'La Maggior Parte dei Rischi Avviene Quando Non C\'è Nessuno',
    problem1Title: 'Anziani Soli Tra le Visite',
    problem1Desc: 'Ore di isolamento in cui l\'ansia e la confusione possono insorgere senza supporto.',
    problem2Title: 'Farmaci Dimenticati',
    problem2Desc: 'Orari complessi spesso portano a errori o dosi saltate senza supervisione.',
    problem3Title: 'Sintomi Non Notati',
    problem3Desc: 'Peggioramenti della salute non rilevati fino alla prossima visita programmata.',
    imageQuote: '"Chi sorveglia quando il caregiver se ne va?"',
    bannerLine1: 'L\'assistenza domiciliare è forte durante la visita.',
    bannerLine2: 'VYVA copre le ore intermedie.'
  }
};

export const Slide2_Problem: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title={t.title} hideLogo>
      <div className="h-full flex flex-col">
        {/* Main Content Area - expands to fill available space */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          
          {/* Left Column - Problems */}
          <div className="flex flex-col justify-center gap-4">
             <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-red-50/50 border border-red-100"
             >
                <div className="bg-red-100 p-2.5 rounded-lg text-red-600 shrink-0">
                    <UserMinus size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{t.problem1Title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{t.problem1Desc}</p>
                </div>
             </motion.div>

             <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-orange-50/50 border border-orange-100"
             >
                <div className="bg-orange-100 p-2.5 rounded-lg text-orange-600 shrink-0">
                    <AlertCircle size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{t.problem2Title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{t.problem2Desc}</p>
                </div>
             </motion.div>
             
             <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-yellow-50/50 border border-yellow-100"
             >
                <div className="bg-yellow-100 p-2.5 rounded-lg text-yellow-600 shrink-0">
                    <EyeOff size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-1">{t.problem3Title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{t.problem3Desc}</p>
                </div>
             </motion.div>
          </div>
          
          {/* Right Column - Image */}
          <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.6, delay: 0.2 }}
             className="h-full rounded-2xl overflow-hidden shadow-lg relative"
          >
            <img 
                src={slideImage}
                alt="Senior alone looking out window" 
                className="w-full h-full object-cover"
            />
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 0.6, delay: 0.8 }}
               className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6"
            >
                <p className="text-white text-lg font-medium">{t.imageQuote}</p>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom Banner - Fixed height, pushed to bottom */}
        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.6, delay: 0.9 }}
           className="mt-4 shrink-0 bg-[#8253AB] text-white p-4 rounded-xl text-center shadow-lg mx-auto max-w-3xl w-full"
        >
            <p className="text-xl md:text-2xl font-medium">
                {t.bannerLine1} <br/>
                <span className="text-[#FFDF61] font-bold">{t.bannerLine2}</span>
            </p>
        </motion.div>
      </div>
    </SlideLayout>
  );
};