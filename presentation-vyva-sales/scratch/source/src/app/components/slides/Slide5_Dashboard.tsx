import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { LayoutDashboard, Bell, Users, Eye, Activity, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: "Your Remote Control: The Caregiver Dashboard",
    missedMeds: "Missed Meds",
    allGood: "All Good",
    lowActivity: "Low Activity",
    liveActivityFeed: "Live Activity Feed",
    checkInMood: "completed check-in. Mood: Happy.",
    alertDizziness: "ALERT: Robert P. reported dizziness.",
    tookMedication: "took morning medication.",
    feature1: {
      title: "Live Overview",
      description: "Real-time status of all seniors. Meds taken, mood, and activity."
    },
    feature2: {
      title: "Smart Alerts",
      description: "Instant notifications for missed doses, falls, or health complaints."
    },
    feature3: {
      title: "Better Visits",
      description: "Caregivers arrive prepared, knowing exactly what happened since the last visit."
    },
    feature4: {
      title: "Role Access",
      description: "Secure access for nurses, coordinators, and family members."
    },
    tryNow: "TRY NOW"
  },
  FR: {
    title: "Votre Télécommande : Le Tableau de Bord de l'Aidant",
    missedMeds: "Médicaments Manqués",
    allGood: "Tout va Bien",
    lowActivity: "Faible Activité",
    liveActivityFeed: "Flux d'Activité en Direct",
    checkInMood: "a terminé l'enregistrement. Humeur : Heureux.",
    alertDizziness: "ALERTE : Robert P. a signalé des étourdissements.",
    tookMedication: "a pris ses médicaments du matin.",
    feature1: {
      title: "Vue d'Ensemble en Direct",
      description: "Statut en temps réel de tous les seniors. Médicaments pris, humeur et activité."
    },
    feature2: {
      title: "Alertes Intelligentes",
      description: "Notifications instantanées pour les doses manquées, les chutes ou les plaintes de santé."
    },
    feature3: {
      title: "Meilleures Visites",
      description: "Les aidants arrivent préparés, sachant exactement ce qui s'est passé depuis la dernière visite."
    },
    feature4: {
      title: "Accès par Rôle",
      description: "Accès sécurisé pour les infirmières, coordinateurs et membres de la famille."
    },
    tryNow: "ESSAYER MAINTENANT"
  },
  DE: {
    title: "Ihre Fernbedienung: Das Pflegekraft-Dashboard",
    missedMeds: "Verpasste Medikamente",
    allGood: "Alles Gut",
    lowActivity: "Niedrige Aktivität",
    liveActivityFeed: "Live-Aktivitätsfeed",
    checkInMood: "hat Check-in abgeschlossen. Stimmung: Glücklich.",
    alertDizziness: "ALARM: Robert P. meldete Schwindel.",
    tookMedication: "hat Morgenmedikamente genommen.",
    feature1: {
      title: "Live-Übersicht",
      description: "Echtzeitstatus aller Senioren. Medikamente eingenommen, Stimmung und Aktivität."
    },
    feature2: {
      title: "Intelligente Alarme",
      description: "Sofortige Benachrichtigungen bei verpassten Dosen, Stürzen oder Gesundheitsbeschwerden."
    },
    feature3: {
      title: "Bessere Besuche",
      description: "Pflegekräfte kommen vorbereitet an und wissen genau, was seit dem letzten Besuch passiert ist."
    },
    feature4: {
      title: "Rollenzugriff",
      description: "Sicherer Zugang für Krankenschwestern, Koordinatoren und Familienmitglieder."
    },
    tryNow: "JETZT TESTEN"
  },
  ES: {
    title: "Su Control Remoto: El Panel del Cuidador",
    missedMeds: "Medicamentos Olvidados",
    allGood: "Todo Bien",
    lowActivity: "Baja Actividad",
    liveActivityFeed: "Feed de Actividad en Vivo",
    checkInMood: "completó el registro. Estado de ánimo: Feliz.",
    alertDizziness: "ALERTA: Robert P. reportó mareos.",
    tookMedication: "tomó la medicación matutina.",
    feature1: {
      title: "Vista General en Vivo",
      description: "Estado en tiempo real de todos los seniors. Medicamentos tomados, estado de ánimo y actividad."
    },
    feature2: {
      title: "Alertas Inteligentes",
      description: "Notificaciones instantáneas por dosis olvidadas, caídas o quejas de salud."
    },
    feature3: {
      title: "Mejores Visitas",
      description: "Los cuidadores llegan preparados, sabiendo exactamente qué sucedió desde la última visita."
    },
    feature4: {
      title: "Acceso por Rol",
      description: "Acceso seguro para enfermeras, coordinadores y miembros de la familia."
    },
    tryNow: "PROBAR AHORA"
  },
  IT: {
    title: "Il Tuo Telecomando: La Dashboard del Caregiver",
    missedMeds: "Farmaci Mancati",
    allGood: "Tutto Bene",
    lowActivity: "Bassa Attività",
    liveActivityFeed: "Feed Attività in Tempo Reale",
    checkInMood: "ha completato il check-in. Umore: Felice.",
    alertDizziness: "ALLARME: Robert P. ha segnalato vertigini.",
    tookMedication: "ha preso i farmaci del mattino.",
    feature1: {
      title: "Panoramica dal Vivo",
      description: "Stato in tempo reale di tutti i senior. Farmaci presi, umore e attività."
    },
    feature2: {
      title: "Avvisi Intelligenti",
      description: "Notifiche istantanee per dosi mancate, cadute o problemi di salute."
    },
    feature3: {
      title: "Visite Migliori",
      description: "I caregiver arrivano preparati, sapendo esattamente cosa è successo dall'ultima visita."
    },
    feature4: {
      title: "Accesso per Ruolo",
      description: "Accesso sicuro per infermieri, coordinatori e familiari."
    },
    tryNow: "PROVA ORA"
  }
};

export const Slide5_Dashboard: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title={t.title} hideLogo>
      <div className="h-full flex flex-col">
        
        {/* Main Graphic Area */}
        <div className="max-h-[45%] bg-gray-900 rounded-2xl p-2 relative overflow-hidden shadow-2xl border-4 border-gray-800 mb-6">
           {/* Mock UI Header */}
           <div className="h-10 bg-gray-800 rounded-t-xl flex items-center px-4 gap-2 border-b border-gray-700">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div className="ml-4 text-gray-400 text-sm font-mono">vyva-dashboard.admin</div>
           </div>
           
           {/* Mock UI Body */}
           <div className="bg-gray-50 h-full p-4 flex gap-4">
              {/* Sidebar */}
              <div className="w-40 hidden md:block space-y-3">
                 <div className="h-6 w-28 bg-gray-200 rounded animate-pulse"></div>
                 <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
                 <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
                 <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
              </div>
              
              {/* Content */}
              <div className="flex-1 space-y-4">
                 <div className="flex justify-between items-center">
                    <div className="h-8 w-40 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-8 w-20 bg-[#8253AB] rounded opacity-50"></div>
                 </div>
                 
                 <div className="grid grid-cols-3 gap-3">
                     {/* Alert Card */}
                     <div className="bg-white p-3 rounded-xl shadow border-l-4 border-red-500">
                        <div className="flex justify-between mb-1.5">
                           <div className="font-bold text-gray-700 text-sm">Maria S.</div>
                           <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">{t.missedMeds}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full mt-1.5"></div>
                     </div>
                     {/* Normal Card */}
                     <div className="bg-white p-3 rounded-xl shadow border-l-4 border-green-500 opacity-70">
                        <div className="flex justify-between mb-1.5">
                           <div className="font-bold text-gray-700 text-sm">John D.</div>
                           <span className="text-xs text-green-500 bg-green-50 px-1.5 py-0.5 rounded-full">{t.allGood}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full mt-1.5"></div>
                     </div>
                     {/* Warning Card */}
                     <div className="bg-white p-3 rounded-xl shadow border-l-4 border-yellow-500">
                        <div className="flex justify-between mb-1.5">
                           <div className="font-bold text-gray-700 text-sm">Robert P.</div>
                           <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-full">{t.lowActivity}</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full mt-1.5"></div>
                     </div>
                 </div>
                 
                 <div className="bg-white h-32 rounded-xl shadow p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="text-gray-400" size={16} />
                        <span className="font-bold text-gray-600 text-sm">{t.liveActivityFeed}</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="w-14 text-xs text-gray-400">10:42 AM</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            <span className="text-xs">Maria S. {t.checkInMood}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="w-14 text-xs text-gray-400">10:30 AM</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            <span className="font-medium text-gray-700 text-xs">{t.alertDizziness}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="w-14 text-xs text-gray-400">09:15 AM</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            <span className="text-xs">John D. {t.tookMedication}</span>
                        </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Feature List */}
        <div className="grid grid-cols-4 gap-5 shrink-0">
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#8253AB] font-bold">
                    <LayoutDashboard size={22} />
                    <h3>{t.feature1.title}</h3>
                </div>
                <p className="text-gray-500">{t.feature1.description}</p>
            </div>
            
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#8253AB] font-bold">
                    <Bell size={22} />
                    <h3>{t.feature2.title}</h3>
                </div>
                <p className="text-gray-500">{t.feature2.description}</p>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#8253AB] font-bold">
                    <Eye size={22} />
                    <h3>{t.feature3.title}</h3>
                </div>
                <p className="text-gray-500">{t.feature3.description}</p>
            </div>

            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#8253AB] font-bold">
                    <Users size={22} />
                    <h3>{t.feature4.title}</h3>
                </div>
                <p className="text-gray-500">{t.feature4.description}</p>
            </div>
        </div>

        {/* TRY NOW Button */}
        <div className="flex justify-center mt-6">
          <a
            href="https://caregiverdb.figma.site/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#FFDF61] hover:bg-[#FFD940] text-[#8253AB] font-bold px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            {t.tryNow}
            <ExternalLink size={18} />
          </a>
        </div>

      </div>
    </SlideLayout>
  );
};