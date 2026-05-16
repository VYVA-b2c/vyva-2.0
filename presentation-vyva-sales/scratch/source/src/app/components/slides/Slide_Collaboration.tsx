import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { Handshake, Rocket, TrendingUp, DollarSign, Award, Users, AlertCircle, Briefcase, HeadphonesIcon } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: "How We Work with Home Care Agencies",
    pill: "COLLABORATION MODEL",
    steps: {
      step1: {
        title: "Pilot Setup",
        bullets: [
          "Sign a simple collaboration agreement.",
          "Choose a small group of seniors to enroll.",
          "VYVA trains your team and sets up the dashboard."
        ]
      },
      step2: {
        title: "Deliver the Service",
        bullets: [
          "You offer <strong>\"Care + VYVA\"</strong> as part of your home care packages.",
          "Caregivers register seniors (with consent) and explain VYVA.",
          "VYVA runs calls, reminders, check-ins and alerts in the background."
        ]
      },
      step3: {
        title: "Review & Scale",
        bullets: [
          "Monthly review of alerts, usage and family feedback.",
          "Decide together how many more seniors to enroll.",
          "Optional <strong>co-branding</strong> and joint marketing campaigns."
        ]
      }
    },
    benefits: [
      { title: "New recurring revenue", description: "per senior using VYVA." },
      { title: "Stronger value proposition", description: "– \"We're there between visits, not only during them.\"" },
      { title: "Higher family satisfaction & retention", description: "through transparency and peace of mind." },
      { title: "Fewer crises and emergency calls", description: "thanks to earlier detection and follow-up." },
      { title: "Minimal extra workload", description: "– your team registers seniors; VYVA automates the rest." },
      { title: "Marketing & training support", description: "from VYVA to help you sell and run the service." }
    ]
  },
  FR: {
    title: "Comment Nous Travaillons avec les Agences de Soins à Domicile",
    pill: "MODÈLE DE COLLABORATION",
    steps: {
      step1: {
        title: "Configuration Pilote",
        bullets: [
          "Signez un accord de collaboration simple.",
          "Choisissez un petit groupe de seniors à inscrire.",
          "VYVA forme votre équipe et configure le tableau de bord."
        ]
      },
      step2: {
        title: "Fournir le Service",
        bullets: [
          "Vous offrez <strong>\"Soins + VYVA\"</strong> dans le cadre de vos forfaits de soins à domicile.",
          "Les aidants enregistrent les seniors (avec consentement) et expliquent VYVA.",
          "VYVA gère les appels, rappels, contrôles et alertes en arrière-plan."
        ]
      },
      step3: {
        title: "Révision et Expansion",
        bullets: [
          "Examen mensuel des alertes, de l'utilisation et des retours des familles.",
          "Décidez ensemble du nombre de seniors supplémentaires à inscrire.",
          "<strong>Co-branding</strong> optionnel et campagnes marketing conjointes."
        ]
      }
    },
    benefits: [
      { title: "Nouveaux revenus récurrents", description: "par senior utilisant VYVA." },
      { title: "Proposition de valeur renforcée", description: "– \"Nous sommes là entre les visites, pas seulement pendant.\"" },
      { title: "Satisfaction et rétention familiales accrues", description: "grâce à la transparence et à la tranquillité d'esprit." },
      { title: "Moins de crises et d'appels d'urgence", description: "grâce à une détection et un suivi précoces." },
      { title: "Charge de travail supplémentaire minimale", description: "– votre équipe enregistre les seniors ; VYVA automatise le reste." },
      { title: "Support marketing et formation", description: "de VYVA pour vous aider à vendre et gérer le service." }
    ]
  },
  DE: {
    title: "Wie Wir mit Häuslichen Pflegeagenturen Zusammenarbeiten",
    pill: "KOLLABORATIONSMODELL",
    steps: {
      step1: {
        title: "Pilot-Setup",
        bullets: [
          "Unterzeichnen Sie eine einfache Kooperationsvereinbarung.",
          "Wählen Sie eine kleine Gruppe von Senioren zur Anmeldung aus.",
          "VYVA schult Ihr Team und richtet das Dashboard ein."
        ]
      },
      step2: {
        title: "Service Bereitstellen",
        bullets: [
          "Sie bieten <strong>\"Pflege + VYVA\"</strong> als Teil Ihrer häuslichen Pflegepakete an.",
          "Pflegekräfte registrieren Senioren (mit Einwilligung) und erklären VYVA.",
          "VYVA führt Anrufe, Erinnerungen, Check-ins und Alarme im Hintergrund aus."
        ]
      },
      step3: {
        title: "Überprüfung & Skalierung",
        bullets: [
          "Monatliche Überprüfung von Alarmen, Nutzung und Familien-Feedback.",
          "Entscheiden Sie gemeinsam, wie viele weitere Senioren angemeldet werden sollen.",
          "Optionales <strong>Co-Branding</strong> und gemeinsame Marketingkampagnen."
        ]
      }
    },
    benefits: [
      { title: "Neue wiederkehrende Einnahmen", description: "pro Senior, der VYVA nutzt." },
      { title: "Stärkeres Wertversprechen", description: "– \"Wir sind zwischen den Besuchen da, nicht nur während.\"" },
      { title: "Höhere Familienzufriedenheit & -bindung", description: "durch Transparenz und Seelenfrieden." },
      { title: "Weniger Krisen und Notrufe", description: "dank früherer Erkennung und Nachverfolgung." },
      { title: "Minimaler zusätzlicher Arbeitsaufwand", description: "– Ihr Team registriert Senioren; VYVA automatisiert den Rest." },
      { title: "Marketing- & Schulungsunterstützung", description: "von VYVA, um Ihnen beim Verkauf und Betrieb des Service zu helfen." }
    ]
  },
  ES: {
    title: "Cómo Trabajamos con Agencias de Atención Domiciliaria",
    pill: "MODELO DE COLABORACIÓN",
    steps: {
      step1: {
        title: "Configuración Piloto",
        bullets: [
          "Firme un acuerdo de colaboración simple.",
          "Elija un pequeño grupo de seniors para inscribir.",
          "VYVA capacita a su equipo y configura el panel."
        ]
      },
      step2: {
        title: "Entregar el Servicio",
        bullets: [
          "Ofrece <strong>\"Atención + VYVA\"</strong> como parte de sus paquetes de atención domiciliaria.",
          "Los cuidadores registran seniors (con consentimiento) y explican VYVA.",
          "VYVA ejecuta llamadas, recordatorios, controles y alertas en segundo plano."
        ]
      },
      step3: {
        title: "Revisión y Escalamiento",
        bullets: [
          "Revisión mensual de alertas, uso y comentarios de familias.",
          "Decidan juntos cuántos seniors más inscribir.",
          "<strong>Co-branding</strong> opcional y campañas de marketing conjuntas."
        ]
      }
    },
    benefits: [
      { title: "Nuevos ingresos recurrentes", description: "por senior que usa VYVA." },
      { title: "Propuesta de valor más fuerte", description: "– \"Estamos ahí entre visitas, no solo durante ellas.\"" },
      { title: "Mayor satisfacción y retención familiar", description: "a través de transparencia y tranquilidad." },
      { title: "Menos crisis y llamadas de emergencia", description: "gracias a la detección y seguimiento tempranos." },
      { title: "Carga de trabajo adicional mínima", description: "– su equipo registra seniors; VYVA automatiza el resto." },
      { title: "Soporte de marketing y capacitación", description: "de VYVA para ayudarle a vender y ejecutar el servicio." }
    ]
  },
  IT: {
    title: "Come Lavoriamo con le Agenzie di Assistenza Domiciliare",
    pill: "MODELLO DI COLLABORAZIONE",
    steps: {
      step1: {
        title: "Configurazione Pilota",
        bullets: [
          "Firma un semplice accordo di collaborazione.",
          "Scegli un piccolo gruppo di senior da iscrivere.",
          "VYVA forma il tuo team e configura la dashboard."
        ]
      },
      step2: {
        title: "Erogare il Servizio",
        bullets: [
          "Offri <strong>\"Assistenza + VYVA\"</strong> come parte dei tuoi pacchetti di assistenza domiciliare.",
          "I caregiver registrano i senior (con consenso) e spiegano VYVA.",
          "VYVA gestisce chiamate, promemoria, controlli e avvisi in background."
        ]
      },
      step3: {
        title: "Revisione e Scalabilità",
        bullets: [
          "Revisione mensile di avvisi, utilizzo e feedback delle famiglie.",
          "Decidete insieme quanti altri senior iscrivere.",
          "<strong>Co-branding</strong> opzionale e campagne di marketing congiunte."
        ]
      }
    },
    benefits: [
      { title: "Nuove entrate ricorrenti", description: "per senior che utilizza VYVA." },
      { title: "Proposta di valore più forte", description: "– \"Siamo presenti tra le visite, non solo durante.\"" },
      { title: "Maggiore soddisfazione e fidelizzazione familiare", description: "attraverso trasparenza e tranquillità." },
      { title: "Meno crisi e chiamate di emergenza", description: "grazie a rilevamento e follow-up precoci." },
      { title: "Carico di lavoro aggiuntivo minimo", description: "– il tuo team registra i senior; VYVA automatizza il resto." },
      { title: "Supporto marketing e formazione", description: "da VYVA per aiutarti a vendere e gestire il servizio." }
    ]
  }
};

export const Slide_Collaboration: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title={t.title} hideLogo>
      <div className="h-full flex flex-col">
        {/* Pill label */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-4"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-block bg-[#FFDF61] text-[#8253AB] px-4 py-1.5 rounded-full text-sm font-bold"
          >
            {t.pill}
          </motion.div>
        </motion.div>

        {/* Main content - two columns */}
        <div className="grid grid-cols-2 gap-5 flex-1 min-h-0">
          {/* Left column - How we collaborate */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col"
          >
            <div className="space-y-2.5 flex-1 overflow-y-auto pr-2">
              {/* Step 1 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white p-3 rounded-xl border-2 border-purple-200 shadow-md hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 bg-[#8253AB] text-white rounded-full flex items-center justify-center font-bold shrink-0 group-hover:scale-110 transition-transform text-sm">
                    1
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{t.steps.step1.title}</h3>
                </div>
                <ul className="text-xs text-gray-700 space-y-1 ml-12 list-disc pl-4 marker:text-[#8253AB]">
                  {t.steps.step1.bullets.map((bullet, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: bullet }} />
                  ))}
                </ul>
              </motion.div>

              {/* Step 2 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white p-3 rounded-xl border-2 border-purple-200 shadow-md hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 bg-[#8253AB] text-white rounded-full flex items-center justify-center font-bold shrink-0 group-hover:scale-110 transition-transform text-sm">
                    2
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{t.steps.step2.title}</h3>
                </div>
                <ul className="text-xs text-gray-700 space-y-1 ml-12 list-disc pl-4 marker:text-[#8253AB]">
                  {t.steps.step2.bullets.map((bullet, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: bullet }} />
                  ))}
                </ul>
              </motion.div>

              {/* Step 3 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                whileHover={{ scale: 1.02 }}
                className="bg-white p-3 rounded-xl border-2 border-purple-200 shadow-md hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-9 h-9 bg-[#8253AB] text-white rounded-full flex items-center justify-center font-bold shrink-0 group-hover:scale-110 transition-transform text-sm">
                    3
                  </div>
                  <h3 className="font-bold text-gray-900 text-sm">{t.steps.step3.title}</h3>
                </div>
                <ul className="text-xs text-gray-700 space-y-1 ml-12 list-disc pl-4 marker:text-[#8253AB]">
                  {t.steps.step3.bullets.map((bullet, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: bullet }} />
                  ))}
                </ul>
              </motion.div>
            </div>
          </motion.div>

          {/* Right column - Benefits */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col"
          >
            
            <div className="space-y-2.5 flex-1 overflow-y-auto pr-2">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="flex items-start gap-2.5"
              >
                <div className="w-7 h-7 bg-green-100 text-green-600 rounded-lg flex items-center justify-center shrink-0">
                  <DollarSign size={14} />
                </div>
                <p className="text-xs text-gray-800 leading-relaxed"><strong className="text-green-700">{t.benefits[0].title}</strong> {t.benefits[0].description}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="flex items-start gap-2.5"
              >
                <div className="w-7 h-7 bg-purple-100 text-[#8253AB] rounded-lg flex items-center justify-center shrink-0">
                  <Rocket size={14} />
                </div>
                <p className="text-xs text-gray-800 leading-relaxed"><strong className="text-[#8253AB]">{t.benefits[1].title}</strong> {t.benefits[1].description}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="flex items-start gap-2.5"
              >
                <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                  <Users size={14} />
                </div>
                <p className="text-xs text-gray-800 leading-relaxed"><strong className="text-blue-700">{t.benefits[2].title}</strong> {t.benefits[2].description}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.9 }}
                className="flex items-start gap-2.5"
              >
                <div className="w-7 h-7 bg-red-100 text-red-600 rounded-lg flex items-center justify-center shrink-0">
                  <AlertCircle size={14} />
                </div>
                <p className="text-xs text-gray-800 leading-relaxed"><strong className="text-red-700">{t.benefits[3].title}</strong> {t.benefits[3].description}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.0 }}
                className="flex items-start gap-2.5"
              >
                <div className="w-7 h-7 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center shrink-0">
                  <Briefcase size={14} />
                </div>
                <p className="text-xs text-gray-800 leading-relaxed"><strong className="text-gray-700">{t.benefits[4].title}</strong> {t.benefits[4].description}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 1.1 }}
                className="flex items-start gap-2.5"
              >
                <div className="w-7 h-7 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center shrink-0">
                  <HeadphonesIcon size={14} />
                </div>
                <p className="text-xs text-gray-800 leading-relaxed"><strong className="text-orange-700">{t.benefits[5].title}</strong> {t.benefits[5].description}</p>
              </motion.div>
            </div>
          </motion.div>
        </div>

      </div>
    </SlideLayout>
  );
};