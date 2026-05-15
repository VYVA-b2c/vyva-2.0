import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { motion } from 'motion/react';
import { ClipboardCheck, HandHeart, Shield } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: "How It Works – Onboarding a Senior in 3 Simple Steps",
    step1: {
      title: "Register the Senior (with consent)",
      bullets: [
        "Choose the seniors you want to enroll.",
        "Explain VYVA and <strong>get their consent</strong>.",
        "Capture preferences: <strong>language, contact channel (phone / WhatsApp), best times and basic profile</strong>."
      ]
    },
    step2: {
      title: "VYVA Says Hello",
      bullets: [
        "VYVA makes a short welcome contact (call or message).",
        "Confirms details and lets the Senior try a simple interaction."
      ]
    },
    step3: {
      title: "Daily Support & Alerts",
      bullets: [
        "VYVA handles reminders, check-ins and safety follow-ups.",
        "Alerts and logs appear automatically in your caregiver dashboard."
      ]
    },
    banner: "You collect consent and preferences. VYVA takes care of the rest."
  },
  FR: {
    title: "Comment ça Marche – Intégrer un Senior en 3 Étapes Simples",
    step1: {
      title: "Enregistrer le Senior (avec consentement)",
      bullets: [
        "Choisissez les seniors que vous souhaitez inscrire.",
        "Expliquez VYVA et <strong>obtenez leur consentement</strong>.",
        "Collectez les préférences : <strong>langue, canal de contact (téléphone / WhatsApp), meilleurs moments et profil de base</strong>."
      ]
    },
    step2: {
      title: "VYVA Dit Bonjour",
      bullets: [
        "VYVA effectue un court contact de bienvenue (appel ou message).",
        "Confirme les détails et laisse le senior essayer une interaction simple."
      ]
    },
    step3: {
      title: "Support Quotidien et Alertes",
      bullets: [
        "VYVA gère les rappels, les vérifications et les suivis de sécurité.",
        "Les alertes et journaux apparaissent automatiquement dans votre tableau de bord."
      ]
    },
    banner: "Vous collectez le consentement et les préférences. VYVA s'occupe du reste."
  },
  DE: {
    title: "Wie es Funktioniert – Onboarding eines Seniors in 3 Einfachen Schritten",
    step1: {
      title: "Senior Registrieren (mit Einwilligung)",
      bullets: [
        "Wählen Sie die Senioren aus, die Sie anmelden möchten.",
        "Erklären Sie VYVA und <strong>holen Sie deren Einwilligung ein</strong>.",
        "Erfassen Sie Präferenzen: <strong>Sprache, Kontaktkanal (Telefon / WhatsApp), beste Zeiten und Basisprofil</strong>."
      ]
    },
    step2: {
      title: "VYVA Sagt Hallo",
      bullets: [
        "VYVA nimmt einen kurzen Willkommenskontakt auf (Anruf oder Nachricht).",
        "Bestätigt Details und lässt den Senior eine einfache Interaktion ausprobieren."
      ]
    },
    step3: {
      title: "Tägliche Unterstützung & Alarme",
      bullets: [
        "VYVA kümmert sich um Erinnerungen, Check-ins und Sicherheitsnachverfolgungen.",
        "Alarme und Protokolle erscheinen automatisch in Ihrem Pflegekraft-Dashboard."
      ]
    },
    banner: "Sie sammeln Einwilligung und Präferenzen. VYVA kümmert sich um den Rest."
  },
  ES: {
    title: "Cómo Funciona – Incorporar a un Senior en 3 Pasos Simples",
    step1: {
      title: "Registrar al Senior (con consentimiento)",
      bullets: [
        "Elija los seniors que desea inscribir.",
        "Explique VYVA y <strong>obtenga su consentimiento</strong>.",
        "Capture preferencias: <strong>idioma, canal de contacto (teléfono / WhatsApp), mejores horarios y perfil básico</strong>."
      ]
    },
    step2: {
      title: "VYVA Dice Hola",
      bullets: [
        "VYVA hace un breve contacto de bienvenida (llamada o mensaje).",
        "Confirma detalles y permite al senior probar una interacción simple."
      ]
    },
    step3: {
      title: "Soporte Diario y Alertas",
      bullets: [
        "VYVA maneja recordatorios, controles y seguimientos de seguridad.",
        "Las alertas y registros aparecen automáticamente en su panel de cuidador."
      ]
    },
    banner: "Usted recopila el consentimiento y las preferencias. VYVA se encarga del resto."
  },
  IT: {
    title: "Come Funziona – Onboarding di un Senior in 3 Semplici Passaggi",
    step1: {
      title: "Registrare il Senior (con consenso)",
      bullets: [
        "Scegli i senior che vuoi iscrivere.",
        "Spiega VYVA e <strong>ottieni il loro consenso</strong>.",
        "Raccogli le preferenze: <strong>lingua, canale di contatto (telefono / WhatsApp), orari migliori e profilo base</strong>."
      ]
    },
    step2: {
      title: "VYVA Dice Ciao",
      bullets: [
        "VYVA effettua un breve contatto di benvenuto (chiamata o messaggio).",
        "Conferma i dettagli e lascia che il senior provi una semplice interazione."
      ]
    },
    step3: {
      title: "Supporto Giornaliero e Avvisi",
      bullets: [
        "VYVA gestisce promemoria, controlli e follow-up di sicurezza.",
        "Gli avvisi e i registri appaiono automaticamente nella tua dashboard del caregiver."
      ]
    },
    banner: "Tu raccogli consenso e preferenze. VYVA si occupa del resto."
  }
};

export const Slide6_Onboarding: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title={t.title} hideLogo>
      <div className="h-full flex flex-col justify-between">
        
        <div className="relative flex-1 flex items-center">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-[#8253AB]/20 via-[#8253AB]/40 to-[#8253AB]/20 -z-10 transform -translate-y-1/2"></div>
            
            <div className="w-full grid grid-cols-3 gap-6">
                {/* Step 1 */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="relative bg-gradient-to-br from-white to-purple-50/30 p-6 rounded-2xl shadow-lg border-2 border-purple-100 flex flex-col items-center text-center group transition-all duration-300"
                >
                    <div className="absolute -bottom-5 bg-[#FFDF61] text-[#8253AB] w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg border-4 border-white">1</div>
                    
                    <div className="mb-4 mt-4 text-white bg-[#8253AB] p-4 rounded-full group-hover:scale-110 transition-transform">
                        <ClipboardCheck size={32} />
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{t.step1.title}</h3>
                    <ul className="text-sm text-gray-700 space-y-2 text-left w-full pl-4 list-disc marker:text-[#8253AB]">
                        {t.step1.bullets.map((bullet, index) => (
                          <li key={index} dangerouslySetInnerHTML={{ __html: bullet }}></li>
                        ))}
                    </ul>
                </motion.div>

                {/* Step 2 */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="relative bg-gradient-to-br from-white to-purple-50/30 p-6 rounded-2xl shadow-lg border-2 border-purple-100 flex flex-col items-center text-center group transition-all duration-300"
                >
                    <div className="absolute -bottom-5 bg-[#FFDF61] text-[#8253AB] w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg border-4 border-white">2</div>
                    
                    <div className="mb-4 mt-4 text-white bg-[#8253AB] p-4 rounded-full group-hover:scale-110 transition-transform">
                        <HandHeart size={32} />
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{t.step2.title}</h3>
                    <ul className="text-sm text-gray-700 space-y-2 text-left w-full pl-4 list-disc marker:text-[#8253AB]">
                        {t.step2.bullets.map((bullet, index) => (
                          <li key={index} dangerouslySetInnerHTML={{ __html: bullet }}></li>
                        ))}
                    </ul>
                </motion.div>

                {/* Step 3 */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="relative bg-gradient-to-br from-white to-purple-50/30 p-6 rounded-2xl shadow-lg border-2 border-purple-100 flex flex-col items-center text-center group transition-all duration-300"
                >
                    <div className="absolute -bottom-5 bg-[#FFDF61] text-[#8253AB] w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg border-4 border-white">3</div>
                    
                    <div className="mb-4 mt-4 text-white bg-[#8253AB] p-4 rounded-full group-hover:scale-110 transition-transform">
                        <Shield size={32} />
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-3">{t.step3.title}</h3>
                    <ul className="text-sm text-gray-700 space-y-2 text-left w-full pl-4 list-disc marker:text-[#8253AB]">
                        {t.step3.bullets.map((bullet, index) => (
                          <li key={index} dangerouslySetInnerHTML={{ __html: bullet }}></li>
                        ))}
                    </ul>
                </motion.div>
            </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-6 flex justify-center shrink-0"
        >
            <div className="bg-[#FFDF61] text-[#8253AB] px-12 py-4 rounded-full font-bold text-lg shadow-xl flex items-center gap-3 border-2 border-[#8253AB]/20">
                <span className="w-3 h-3 bg-[#8253AB] rounded-full animate-pulse"></span>
                {t.banner}
            </div>
        </motion.div>
      </div>
    </SlideLayout>
  );
};