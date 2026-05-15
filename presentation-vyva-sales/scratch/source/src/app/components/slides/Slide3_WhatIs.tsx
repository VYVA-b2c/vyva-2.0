import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { motion } from 'motion/react';
import { Pill, AlertCircle, MessageCircle, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import seniorPhone from 'figma:asset/43ece571d97b3cc52e42f97e43f30d4eafe1f97a.png';

const translations = {
  EN: {
    title: "VYVA – A Digital Companion for Every Senior",
    pill: "IN ACTION",
    subtitle: "Real moments where VYVA steps in between visits.",
    card1: {
      time: "8:00 – Morning medication",
      description: "VYVA reminds the senior to take their pills, waits for a \"Yes, I've taken them\", and logs it for the caregiver."
    },
    card2: {
      time: "16:30 - \"I am lonely\"",
      description: "VYVA checks in for a friendly chat, plays a quick brain game, and captures mood so caregivers see if the senior is withdrawing."
    },
    card3: {
      time: "20h30 - \"I am hungry\"",
      description: "VYVA takes voice orders for food, groceries, or supplies anytime, coordinating delivery so seniors can request what they need without touching a phone."
    },
    card4: {
      time: "23h:30 - \"Help me\"",
      description: "A possible fall triggers an immediate voice check-in; if there's no answer, VYVA sends an alert with time and last known status."
    },
    banner: "24/7 presence without 24/7 staffing."
  },
  FR: {
    title: "VYVA – Un Compagnon Numérique pour Chaque Senior",
    pill: "EN ACTION",
    subtitle: "Des moments réels où VYVA intervient entre les visites.",
    card1: {
      time: "8h00 – Médicaments du matin",
      description: "VYVA rappelle au senior de prendre ses médicaments, attend un \"Oui, je les ai pris\", et l'enregistre pour l'aidant."
    },
    card2: {
      time: "16h30 - \"Je me sens seul\"",
      description: "VYVA engage une conversation amicale, propose un jeu cérébral rapide et capture l'humeur pour que les aidants voient si le senior s'isole."
    },
    card3: {
      time: "20h30 - \"J'ai faim\"",
      description: "VYVA prend des commandes vocales pour nourriture, courses ou fournitures à tout moment, coordonne la livraison pour que les seniors puissent demander ce dont ils ont besoin sans toucher un téléphone."
    },
    card4: {
      time: "23h30 - \"Aidez-moi\"",
      description: "Une chute possible déclenche un contrôle vocal immédiat ; s'il n'y a pas de réponse, VYVA envoie une alerte avec l'heure et le dernier état connu."
    },
    banner: "Présence 24/7 sans personnel 24/7."
  },
  DE: {
    title: "VYVA – Ein Digitaler Begleiter für Jeden Senior",
    pill: "IN AKTION",
    subtitle: "Echte Momente, in denen VYVA zwischen den Besuchen eingreift.",
    card1: {
      time: "8:00 – Morgenmedikation",
      description: "VYVA erinnert den Senior daran, seine Medikamente zu nehmen, wartet auf ein \"Ja, ich habe sie genommen\" und protokolliert es für die Pflegekraft."
    },
    card2: {
      time: "16:30 - \"Ich bin einsam\"",
      description: "VYVA führt ein freundliches Gespräch, spielt ein schnelles Denkspiel und erfasst die Stimmung, damit Pflegekräfte sehen können, ob sich der Senior zurückzieht."
    },
    card3: {
      time: "20:30 - \"Ich habe Hunger\"",
      description: "VYVA nimmt jederzeit Sprachbestellungen für Essen, Lebensmittel oder Vorräte entgegen, koordiniert die Lieferung, damit Senioren anfordern können, was sie brauchen, ohne ein Telefon zu berühren."
    },
    card4: {
      time: "23:30 - \"Hilf mir\"",
      description: "Ein möglicher Sturz löst eine sofortige Sprachüberprüfung aus; wenn keine Antwort erfolgt, sendet VYVA eine Warnung mit Uhrzeit und letztem bekannten Status."
    },
    banner: "24/7-Präsenz ohne 24/7-Personal."
  },
  ES: {
    title: "VYVA – Un Compañero Digital para Cada Senior",
    pill: "EN ACCIÓN",
    subtitle: "Momentos reales donde VYVA interviene entre visitas.",
    card1: {
      time: "8:00 – Medicación matutina",
      description: "VYVA recuerda al senior que tome sus pastillas, espera un \"Sí, las he tomado\" y lo registra para el cuidador."
    },
    card2: {
      time: "16:30 - \"Me siento solo\"",
      description: "VYVA inicia una charla amigable, juega un rápido juego cerebral y captura el estado de ánimo para que los cuidadores vean si el senior se está aislando."
    },
    card3: {
      time: "20:30 - \"Tengo hambre\"",
      description: "VYVA toma pedidos por voz de comida, compras o suministros en cualquier momento, coordinando la entrega para que los seniors puedan solicitar lo que necesitan sin tocar un teléfono."
    },
    card4: {
      time: "23:30 - \"Ayúdame\"",
      description: "Una posible caída desencadena un chequeo de voz inmediato; si no hay respuesta, VYVA envía una alerta con la hora y el último estado conocido."
    },
    banner: "Presencia 24/7 sin personal 24/7."
  },
  IT: {
    title: "VYVA – Un Compagno Digitale per Ogni Senior",
    pill: "IN AZIONE",
    subtitle: "Momenti reali in cui VYVA interviene tra le visite.",
    card1: {
      time: "8:00 – Medicazione mattutina",
      description: "VYVA ricorda al senior di prendere le medicine, aspetta un \"Sì, le ho prese\" e lo registra per il caregiver."
    },
    card2: {
      time: "16:30 - \"Mi sento solo\"",
      description: "VYVA avvia una chiacchierata amichevole, gioca a un rapido gioco mentale e cattura l'umore così i caregiver possono vedere se il senior si sta isolando."
    },
    card3: {
      time: "20:30 - \"Ho fame\"",
      description: "VYVA riceve ordini vocali per cibo, spesa o forniture in qualsiasi momento, coordinando la consegna così i senior possono richiedere ciò di cui hanno bisogno senza toccare un telefono."
    },
    card4: {
      time: "23:30 - \"Aiutami\"",
      description: "Una possibile caduta attiva un controllo vocale immediato; se non c'è risposta, VYVA invia un avviso con l'ora e l'ultimo stato conosciuto."
    },
    banner: "Presenza 24/7 senza personale 24/7."
  }
};

export const Slide3_WhatIs: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title={t.title} hideLogo>
      <div className="h-full flex flex-col">
        {/* Label Pill and Subtitle */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-3"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-block bg-[#8253AB] text-white px-4 py-1.5 rounded-full text-sm font-bold mb-2"
          >
            {t.pill}
          </motion.div>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-gray-600 italic text-base"
          >
            {t.subtitle}
          </motion.p>
        </motion.div>

        {/* Main Content - Circular Layout */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center mb-4">
          {/* Background decorative circles */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              className="w-96 h-96 rounded-full border-2 border-purple-100 opacity-30"
            ></motion.div>
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
              className="w-[500px] h-[500px] rounded-full border-2 border-yellow-100 opacity-20 absolute"
            ></motion.div>
          </motion.div>

          {/* Connecting lines from cards to center */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
            <motion.line
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              x1="25%" y1="25%" x2="50%" y2="50%"
              stroke="#8253AB"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
            <motion.line
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              x1="75%" y1="25%" x2="50%" y2="50%"
              stroke="#FFDF61"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
            <motion.line
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              x1="25%" y1="75%" x2="50%" y2="50%"
              stroke="#8253AB"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
            <motion.line
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.2 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              x1="75%" y1="75%" x2="50%" y2="50%"
              stroke="#FFDF61"
              strokeWidth="2"
              strokeDasharray="5,5"
            />
          </svg>
          
          {/* Center Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.6, type: "spring", stiffness: 100, damping: 15 }}
            className="relative z-10"
          >
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-64 h-64 rounded-full overflow-hidden border-8 border-white shadow-2xl relative"
            >
              <ImageWithFallback
                src={seniorPhone}
                alt="Happy senior"
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay for better contrast */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#8253AB]/10 to-[#FFDF61]/10"></div>
            </motion.div>
            {/* Decorative rings with animation */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute inset-0 rounded-full border-4 border-[#FFDF61] opacity-30 scale-110"
            ></motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.3 }}
              className="absolute inset-0 rounded-full border-4 border-[#8253AB] opacity-20 scale-[1.2]"
            ></motion.div>
          </motion.div>

          {/* Benefit Cards - Positioned Around Center */}
          {/* Top Left - Morning Medication */}
          <motion.div
            initial={{ opacity: 0, x: -60, y: -60, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.8, type: "spring", stiffness: 80, damping: 12 }}
            className="absolute top-2 left-2 w-72"
          >
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-gradient-to-br from-purple-50 to-purple-100/50 backdrop-blur-sm border-2 border-purple-200 p-4 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow group"
            >
              <div className="flex items-start gap-3">
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.15 }}
                  transition={{ duration: 0.5 }}
                  className="w-12 h-12 bg-gradient-to-br from-[#8253AB] to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"
                >
                  <Pill size={22} />
                </motion.div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight mb-1.5">{t.card1.time}</h3>
                  <p className="text-gray-600 text-xs leading-relaxed">{t.card1.description}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Top Right - Alone in the Afternoon */}
          <motion.div
            initial={{ opacity: 0, x: 60, y: -60, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 1.0, type: "spring", stiffness: 80, damping: 12 }}
            className="absolute top-2 right-2 w-72"
          >
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 backdrop-blur-sm border-2 border-yellow-200 p-4 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow group"
            >
              <div className="flex items-start gap-3">
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.15 }}
                  transition={{ duration: 0.5 }}
                  className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"
                >
                  <MessageCircle size={22} />
                </motion.div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight mb-1.5">{t.card2.time}</h3>
                  <p className="text-gray-600 text-xs leading-relaxed">{t.card2.description}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Bottom Left - I Don't Feel Well */}
          <motion.div
            initial={{ opacity: 0, x: -60, y: 60, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 1.2, type: "spring", stiffness: 80, damping: 12 }}
            className="absolute bottom-2 left-2 w-72"
          >
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-gradient-to-br from-purple-50 to-purple-100/50 backdrop-blur-sm border-2 border-purple-200 p-4 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow group"
            >
              <div className="flex items-start gap-3">
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.15 }}
                  transition={{ duration: 0.5 }}
                  className="w-12 h-12 bg-gradient-to-br from-[#8253AB] to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"
                >
                  <AlertCircle size={22} />
                </motion.div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight mb-1.5">{t.card3.time}</h3>
                  <p className="text-gray-600 text-xs leading-relaxed">{t.card3.description}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Bottom Right - A Slip in the Hallway */}
          <motion.div
            initial={{ opacity: 0, x: 60, y: 60, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 1.4, type: "spring", stiffness: 80, damping: 12 }}
            className="absolute bottom-2 right-2 w-72"
          >
            <motion.div 
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 backdrop-blur-sm border-2 border-yellow-200 p-4 rounded-2xl shadow-xl hover:shadow-2xl transition-shadow group"
            >
              <div className="flex items-start gap-3">
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.15 }}
                  transition={{ duration: 0.5 }}
                  className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-white shadow-lg shrink-0"
                >
                  <ShieldAlert size={22} />
                </motion.div>
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight mb-1.5">{t.card4.time}</h3>
                  <p className="text-gray-600 text-xs leading-relaxed">{t.card4.description}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom Banner - Compact & Branded */}
        <motion.div 
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 1.6, type: "spring", stiffness: 100, damping: 15 }}
          whileHover={{ scale: 1.02, y: -2 }}
          className="shrink-0 bg-[#FFDF61] text-[#8253AB] p-3 rounded-xl text-center shadow-md mx-auto w-full max-w-4xl"
        >
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8, duration: 0.5 }}
              className="text-xl font-bold tracking-tight"
            >
                {t.banner}
            </motion.h2>
        </motion.div>
      </div>
    </SlideLayout>
  );
};
