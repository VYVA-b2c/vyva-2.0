import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { Eye, Clock, CheckSquare, PhoneOff, Heart, Star, LayoutDashboard, Bell, History, UserCircle, Lock, Plug } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: "VYVA for Care Providers – More Control Between Visits",
    pill: "FOR PROVIDERS",
    subtitle: "Operational benefits and smart tools for your team.",
    leftColumn: "What you gain",
    rightColumn: "What VYVA provides",
    benefits: {
      visibility: {
        title: "24/7 visibility",
        description: "into each Senior between visits."
      },
      intervention: {
        title: "Earlier intervention",
        description: "when something starts to go wrong (symptoms, mood, falls)."
      },
      visits: {
        title: "More efficient visits",
        description: "– caregivers arrive already knowing what happened since last time."
      },
      chasing: {
        title: "Less manual chasing",
        description: "– fewer phone check-ins, more automated alerts."
      },
      trust: {
        title: "Stronger trust with families",
        description: "through transparent monitoring and updates."
      },
      differentiation: {
        title: "Clear differentiation",
        description: "as a tech-enabled care provider, not just an hours-based service."
      }
    },
    features: {
      dashboard: {
        title: "Caregiver Dashboard",
        description: "with real-time overview of all Seniors."
      },
      alerts: {
        title: "Smart alerts",
        description: "for missed medication, potential falls, \"I don't feel well\" events, and prolonged inactivity."
      },
      history: {
        title: "History & logs",
        description: "of adherence, mood, and symptom reports to spot trends."
      },
      profiles: {
        title: "Profiles & preferences",
        description: "(language, routines, contact rules) for each Senior."
      },
      access: {
        title: "Role-based access",
        description: "for nurses, coordinators, and family members."
      },
      rollout: {
        title: "Easy rollout",
        description: "– Seniors connect via phone, smartphone, or WhatsApp; no complex hardware."
      }
    }
  },
  FR: {
    title: "VYVA pour les Fournisseurs de Soins – Plus de Contrôle Entre les Visites",
    pill: "POUR LES PRESTATAIRES",
    subtitle: "Avantages opérationnels et outils intelligents pour votre équipe.",
    leftColumn: "Ce que vous gagnez",
    rightColumn: "Ce que VYVA offre",
    benefits: {
      visibility: {
        title: "Visibilité 24/7",
        description: "sur chaque senior entre les visites."
      },
      intervention: {
        title: "Intervention précoce",
        description: "quand quelque chose commence à mal tourner (symptômes, humeur, chutes)."
      },
      visits: {
        title: "Visites plus efficaces",
        description: "– les aidants arrivent en sachant déjà ce qui s'est passé depuis la dernière fois."
      },
      chasing: {
        title: "Moins de suivi manuel",
        description: "– moins d'appels de contrôle, plus d'alertes automatisées."
      },
      trust: {
        title: "Confiance renforcée avec les familles",
        description: "grâce à une surveillance et des mises à jour transparentes."
      },
      differentiation: {
        title: "Différenciation claire",
        description: "en tant que fournisseur de soins technologiquement avancé, pas seulement un service basé sur les heures."
      }
    },
    features: {
      dashboard: {
        title: "Tableau de Bord des Aidants",
        description: "avec vue d'ensemble en temps réel de tous les seniors."
      },
      alerts: {
        title: "Alertes intelligentes",
        description: "pour les médicaments oubliés, les chutes potentielles, les événements \"je ne me sens pas bien\" et l'inactivité prolongée."
      },
      history: {
        title: "Historique et journaux",
        description: "d'observance, d'humeur et de rapports de symptômes pour détecter les tendances."
      },
      profiles: {
        title: "Profils et préférences",
        description: "(langue, routines, règles de contact) pour chaque senior."
      },
      access: {
        title: "Accès basé sur les rôles",
        description: "pour les infirmières, coordinateurs et membres de la famille."
      },
      rollout: {
        title: "Déploiement facile",
        description: "– Les seniors se connectent par téléphone, smartphone ou WhatsApp ; pas de matériel complexe."
      }
    }
  },
  DE: {
    title: "VYVA für Pflegeanbieter – Mehr Kontrolle Zwischen den Besuchen",
    pill: "FÜR ANBIETER",
    subtitle: "Operative Vorteile und intelligente Tools für Ihr Team.",
    leftColumn: "Was Sie gewinnen",
    rightColumn: "Was VYVA bietet",
    benefits: {
      visibility: {
        title: "24/7-Sichtbarkeit",
        description: "für jeden Senior zwischen den Besuchen."
      },
      intervention: {
        title: "Frühere Intervention",
        description: "wenn etwas schief zu gehen beginnt (Symptome, Stimmung, Stürze)."
      },
      visits: {
        title: "Effizientere Besuche",
        description: "– Pflegekräfte kommen bereits informiert an, was seit dem letzten Mal passiert ist."
      },
      chasing: {
        title: "Weniger manuelles Nachverfolgen",
        description: "– weniger telefonische Check-ins, mehr automatisierte Warnungen."
      },
      trust: {
        title: "Stärkeres Vertrauen bei Familien",
        description: "durch transparente Überwachung und Updates."
      },
      differentiation: {
        title: "Klare Differenzierung",
        description: "als technologiegestützter Pflegeanbieter, nicht nur ein stundenbasierter Service."
      }
    },
    features: {
      dashboard: {
        title: "Pflegekraft-Dashboard",
        description: "mit Echtzeit-Übersicht aller Senioren."
      },
      alerts: {
        title: "Intelligente Alarme",
        description: "für verpasste Medikamente, mögliche Stürze, \"Mir geht es nicht gut\"-Ereignisse und längere Inaktivität."
      },
      history: {
        title: "Historie & Protokolle",
        description: "von Einhaltung, Stimmung und Symptomberichten zur Erkennung von Trends."
      },
      profiles: {
        title: "Profile & Präferenzen",
        description: "(Sprache, Routinen, Kontaktregeln) für jeden Senior."
      },
      access: {
        title: "Rollenbasierter Zugriff",
        description: "für Krankenschwestern, Koordinatoren und Familienmitglieder."
      },
      rollout: {
        title: "Einfache Einführung",
        description: "– Senioren verbinden sich per Telefon, Smartphone oder WhatsApp; keine komplexe Hardware."
      }
    }
  },
  ES: {
    title: "VYVA para Proveedores de Atención – Más Control Entre Visitas",
    pill: "PARA PROVEEDORES",
    subtitle: "Beneficios operacionales y herramientas inteligentes para su equipo.",
    leftColumn: "Lo que gana",
    rightColumn: "Lo que VYVA ofrece",
    benefits: {
      visibility: {
        title: "Visibilidad 24/7",
        description: "en cada senior entre visitas."
      },
      intervention: {
        title: "Intervención temprana",
        description: "cuando algo comienza a ir mal (síntomas, estado de ánimo, caídas)."
      },
      visits: {
        title: "Visitas más eficientes",
        description: "– los cuidadores llegan ya sabiendo qué sucedió desde la última vez."
      },
      chasing: {
        title: "Menos seguimiento manual",
        description: "– menos llamadas de control, más alertas automatizadas."
      },
      trust: {
        title: "Mayor confianza con las familias",
        description: "a través de monitoreo transparente y actualizaciones."
      },
      differentiation: {
        title: "Diferenciación clara",
        description: "como proveedor de atención habilitado por tecnología, no solo un servicio basado en horas."
      }
    },
    features: {
      dashboard: {
        title: "Panel del Cuidador",
        description: "con vista general en tiempo real de todos los seniors."
      },
      alerts: {
        title: "Alertas inteligentes",
        description: "para medicamentos olvidados, caídas potenciales, eventos de \"no me siento bien\" e inactividad prolongada."
      },
      history: {
        title: "Historial y registros",
        description: "de adherencia, estado de ánimo e informes de síntomas para detectar tendencias."
      },
      profiles: {
        title: "Perfiles y preferencias",
        description: "(idioma, rutinas, reglas de contacto) para cada senior."
      },
      access: {
        title: "Acceso basado en roles",
        description: "para enfermeras, coordinadores y miembros de la familia."
      },
      rollout: {
        title: "Implementación fácil",
        description: "– Los seniors se conectan por teléfono, smartphone o WhatsApp; sin hardware complejo."
      }
    }
  },
  IT: {
    title: "VYVA per Fornitori di Assistenza – Più Controllo Tra le Visite",
    pill: "PER FORNITORI",
    subtitle: "Vantaggi operativi e strumenti intelligenti per il tuo team.",
    leftColumn: "Cosa guadagni",
    rightColumn: "Cosa offre VYVA",
    benefits: {
      visibility: {
        title: "Visibilità 24/7",
        description: "su ogni senior tra le visite."
      },
      intervention: {
        title: "Intervento precoce",
        description: "quando qualcosa inizia ad andare storto (sintomi, umore, cadute)."
      },
      visits: {
        title: "Visite più efficienti",
        description: "– i caregiver arrivano già sapendo cosa è successo dall'ultima volta."
      },
      chasing: {
        title: "Meno inseguimenti manuali",
        description: "– meno controlli telefonici, più avvisi automatici."
      },
      trust: {
        title: "Maggiore fiducia con le famiglie",
        description: "attraverso monitoraggio trasparente e aggiornamenti."
      },
      differentiation: {
        title: "Chiara differenziazione",
        description: "come fornitore di assistenza abilitato dalla tecnologia, non solo un servizio basato sulle ore."
      }
    },
    features: {
      dashboard: {
        title: "Dashboard del Caregiver",
        description: "con panoramica in tempo reale di tutti i senior."
      },
      alerts: {
        title: "Avvisi intelligenti",
        description: "per farmaci mancati, cadute potenziali, eventi \"non mi sento bene\" e inattività prolungata."
      },
      history: {
        title: "Storia e registri",
        description: "di aderenza, umore e report dei sintomi per individuare tendenze."
      },
      profiles: {
        title: "Profili e preferenze",
        description: "(lingua, routine, regole di contatto) per ogni senior."
      },
      access: {
        title: "Accesso basato sui ruoli",
        description: "per infermieri, coordinatori e familiari."
      },
      rollout: {
        title: "Implementazione facile",
        description: "– I senior si connettono tramite telefono, smartphone o WhatsApp; nessun hardware complesso."
      }
    }
  }
};

export const Slide_CareProvider: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title={t.title} hideLogo>
      <div className="h-full flex flex-col">
        {/* Subtitle */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-2"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-block bg-[#8253AB] text-white px-3 py-1 rounded-full text-xs font-bold"
          >
            {t.pill}
          </motion.div>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          {/* Left Column - What you gain */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col bg-gradient-to-br from-purple-50/50 to-white rounded-2xl p-4 border-2 border-purple-100 shadow-lg"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-[#8253AB] rounded-lg flex items-center justify-center">
                <Star size={16} className="text-white" />
              </div>
              <h2 className="text-lg font-bold text-[#8253AB]">{t.leftColumn}</h2>
            </div>
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                whileHover={{ scale: 1.02, x: 3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-purple-200/50 hover:border-[#8253AB] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-purple-100 text-[#8253AB] rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Eye size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-[#8253AB]">{t.benefits.visibility.title}</strong> {t.benefits.visibility.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                whileHover={{ scale: 1.02, x: 3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-purple-200/50 hover:border-[#8253AB] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-blue-700">{t.benefits.intervention.title}</strong> {t.benefits.intervention.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                whileHover={{ scale: 1.02, x: 3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-purple-200/50 hover:border-[#8253AB] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <CheckSquare size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-green-700">{t.benefits.visits.title}</strong> {t.benefits.visits.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.9 }}
                whileHover={{ scale: 1.02, x: 3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-purple-200/50 hover:border-[#8253AB] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <PhoneOff size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-gray-700">{t.benefits.chasing.title}</strong> {t.benefits.chasing.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.0 }}
                whileHover={{ scale: 1.02, x: 3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-purple-200/50 hover:border-[#8253AB] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Heart size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-red-700">{t.benefits.trust.title}</strong> {t.benefits.trust.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.1 }}
                whileHover={{ scale: 1.02, x: 3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-purple-200/50 hover:border-[#8253AB] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Star size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-amber-700">{t.benefits.differentiation.title}</strong> {t.benefits.differentiation.description}</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Column - What VYVA provides */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col bg-gradient-to-br from-yellow-50/50 to-white rounded-2xl p-4 border-2 border-yellow-200 shadow-lg"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-[#FFDF61] rounded-lg flex items-center justify-center">
                <LayoutDashboard size={16} className="text-[#8253AB]" />
              </div>
              <h2 className="text-lg font-bold text-[#8253AB]">{t.rightColumn}</h2>
            </div>
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                whileHover={{ scale: 1.02, x: -3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-yellow-200/50 hover:border-[#FFDF61] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-purple-100 text-[#8253AB] rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <LayoutDashboard size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-[#8253AB]">{t.features.dashboard.title}</strong> {t.features.dashboard.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                whileHover={{ scale: 1.02, x: -3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-yellow-200/50 hover:border-[#FFDF61] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Bell size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-orange-700">{t.features.alerts.title}</strong> {t.features.alerts.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                whileHover={{ scale: 1.02, x: -3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-yellow-200/50 hover:border-[#FFDF61] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <History size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-blue-700">{t.features.history.title}</strong> {t.features.history.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.9 }}
                whileHover={{ scale: 1.02, x: -3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-yellow-200/50 hover:border-[#FFDF61] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <UserCircle size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-indigo-700">{t.features.profiles.title}</strong> {t.features.profiles.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.0 }}
                whileHover={{ scale: 1.02, x: -3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-yellow-200/50 hover:border-[#FFDF61] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Lock size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-purple-700">{t.features.access.title}</strong> {t.features.access.description}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.1 }}
                whileHover={{ scale: 1.02, x: -3 }}
                className="flex items-start gap-2 p-2 bg-white rounded-xl border border-yellow-200/50 hover:border-[#FFDF61] hover:shadow-md transition-all group"
              >
                <div className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Plug size={16} />
                </div>
                <div>
                  <p className="text-gray-800 text-xs leading-relaxed"><strong className="text-green-700">{t.features.rollout.title}</strong> {t.features.rollout.description}</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>

      </div>
    </SlideLayout>
  );
};