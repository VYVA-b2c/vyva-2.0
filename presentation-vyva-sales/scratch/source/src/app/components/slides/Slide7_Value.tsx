import React from 'react';
import { SlideLayout } from '../SlideLayout';
import { TrendingUp, Shield, Star, Briefcase } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const translations = {
  EN: {
    title: "Why Home Care Agencies Choose VYVA",
    cards: [
      {
        title: "Competitive Advantage",
        description: "Offer a premium, \"tech-enabled\" service that differentiates you from traditional agencies. Extend your service without extending payroll."
      },
      {
        title: "Risk Reduction",
        description: "Fewer emergencies and hospitalizations through proactive monitoring. Catch issues before they become crises."
      },
      {
        title: "Value for Families",
        description: "Provide families with peace of mind knowing their loved ones are monitored 24/7, even when a caregiver isn't present."
      },
      {
        title: "Better Retention",
        description: "Caregivers feel more supported and prepared, leading to higher job satisfaction and lower turnover rates."
      }
    ]
  },
  FR: {
    title: "Pourquoi les Agences de Soins à Domicile Choisissent VYVA",
    cards: [
      {
        title: "Avantage Concurrentiel",
        description: "Offrez un service premium \"technologiquement avancé\" qui vous différencie des agences traditionnelles. Étendez votre service sans augmenter la masse salariale."
      },
      {
        title: "Réduction des Risques",
        description: "Moins d'urgences et d'hospitalisations grâce à une surveillance proactive. Détectez les problèmes avant qu'ils ne deviennent des crises."
      },
      {
        title: "Valeur pour les Familles",
        description: "Offrez aux familles la tranquillité d'esprit en sachant que leurs proches sont surveillés 24h/24 et 7j/7, même en l'absence d'un aidant."
      },
      {
        title: "Meilleure Rétention",
        description: "Les aidants se sentent mieux soutenus et préparés, ce qui se traduit par une satisfaction professionnelle plus élevée et des taux de rotation plus faibles."
      }
    ]
  },
  DE: {
    title: "Warum Häusliche Pflegeagenturen VYVA Wählen",
    cards: [
      {
        title: "Wettbewerbsvorteil",
        description: "Bieten Sie einen Premium-Service mit \"Technologie\" an, der Sie von traditionellen Agenturen unterscheidet. Erweitern Sie Ihren Service ohne Personalkosten zu erhöhen."
      },
      {
        title: "Risikominderung",
        description: "Weniger Notfälle und Krankenhausaufenthalte durch proaktive Überwachung. Erkennen Sie Probleme, bevor sie zu Krisen werden."
      },
      {
        title: "Wert für Familien",
        description: "Geben Sie Familien die Gewissheit, dass ihre Angehörigen rund um die Uhr überwacht werden, auch wenn keine Pflegekraft anwesend ist."
      },
      {
        title: "Bessere Bindung",
        description: "Pflegekräfte fühlen sich besser unterstützt und vorbereitet, was zu höherer Arbeitszufriedenheit und niedrigeren Fluktuationsraten führt."
      }
    ]
  },
  ES: {
    title: "Por Qué las Agencias de Atención Domiciliaria Eligen VYVA",
    cards: [
      {
        title: "Ventaja Competitiva",
        description: "Ofrezca un servicio premium \"habilitado por tecnología\" que lo diferencia de las agencias tradicionales. Extienda su servicio sin extender la nómina."
      },
      {
        title: "Reducción de Riesgos",
        description: "Menos emergencias y hospitalizaciones mediante monitoreo proactivo. Detecte problemas antes de que se conviertan en crisis."
      },
      {
        title: "Valor para las Familias",
        description: "Brinde a las familias tranquilidad sabiendo que sus seres queridos son monitoreados 24/7, incluso cuando no hay un cuidador presente."
      },
      {
        title: "Mejor Retención",
        description: "Los cuidadores se sienten más apoyados y preparados, lo que lleva a una mayor satisfacción laboral y menores tasas de rotación."
      }
    ]
  },
  IT: {
    title: "Perché le Agenzie di Assistenza Domiciliare Scelgono VYVA",
    cards: [
      {
        title: "Vantaggio Competitivo",
        description: "Offri un servizio premium \"abilitato dalla tecnologia\" che ti differenzia dalle agenzie tradizionali. Estendi il tuo servizio senza estendere il libro paga."
      },
      {
        title: "Riduzione del Rischio",
        description: "Meno emergenze e ricoveri ospedalieri attraverso il monitoraggio proattivo. Individua i problemi prima che diventino crisi."
      },
      {
        title: "Valore per le Famiglie",
        description: "Fornisci alle famiglie la tranquillità sapendo che i loro cari sono monitorati 24 ore su 24, 7 giorni su 7, anche quando un caregiver non è presente."
      },
      {
        title: "Migliore Fidelizzazione",
        description: "I caregiver si sentono più supportati e preparati, portando a una maggiore soddisfazione lavorativa e tassi di turnover più bassi."
      }
    ]
  }
};

export const Slide7_Value: React.FC = () => {
  const { currentLanguage } = useLanguage();
  const t = translations[currentLanguage];

  return (
    <SlideLayout title={t.title} hideLogo>
      <div className="h-full flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-white to-purple-50 p-6 rounded-2xl shadow-sm border border-purple-100 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-purple-100 rounded-lg text-[#8253AB]">
                        <Briefcase size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">{t.cards[0].title}</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                    {t.cards[0].description}
                </p>
            </div>

            <div className="bg-gradient-to-br from-white to-green-50 p-6 rounded-2xl shadow-sm border border-green-100 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-green-100 rounded-lg text-green-600">
                        <Shield size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">{t.cards[1].title}</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                    {t.cards[1].description}
                </p>
            </div>

            <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-sm border border-blue-100 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-blue-100 rounded-lg text-blue-600">
                        <Star size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">{t.cards[2].title}</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                    {t.cards[2].description}
                </p>
            </div>

            <div className="bg-gradient-to-br from-white to-yellow-50 p-6 rounded-2xl shadow-sm border border-yellow-100 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-yellow-100 rounded-lg text-yellow-600">
                        <TrendingUp size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">{t.cards[3].title}</h3>
                </div>
                <p className="text-gray-600 leading-relaxed">
                    {t.cards[3].description}
                </p>
            </div>
        </div>
      </div>
    </SlideLayout>
  );
};