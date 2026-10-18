import type { LanguageCode } from "./languages";

const en = {
  disabled: "Account access disabled", upgrade: "Plan upgrade needed",
  addMedicine: "Add one medication first",
  medicineRequired: "Medication reminders and reports need at least one medication in your profile.",
  setup: "Complete this setup step", setupDescription: "Complete your profile before using this service.",
  preparing: "Preparing this service", preparingDescription: "VYVA is checking your setup so this page can open safely.",
  completeFirst: "Complete setup first", reviewPlan: "Review plan", finishSetup: "Finish setup", accessCheck: "VYVA access check",
};
export const serviceGateTranslations: Record<LanguageCode, { [K in keyof typeof en]: string }> = {
  en,
  es: {
    disabled: "Acceso a la cuenta desactivado", upgrade: "Necesitas cambiar de plan", addMedicine: "Añade primero un medicamento",
    medicineRequired: "Los recordatorios y los informes de medicación necesitan al menos un medicamento en tu perfil.",
    setup: "Completa este paso", setupDescription: "Completa tu perfil antes de usar este servicio.", preparing: "Preparando el servicio",
    preparingDescription: "VYVA está comprobando tu configuración para abrir esta página de forma segura.", completeFirst: "Completa primero la configuración",
    reviewPlan: "Revisar el plan", finishSetup: "Completar la configuración", accessCheck: "Comprobación de acceso de VYVA",
  },
  fr: {
    disabled: "Accès au compte désactivé", upgrade: "Changement de forfait nécessaire", addMedicine: "Ajoutez d'abord un médicament",
    medicineRequired: "Les rappels et les rapports de médicaments nécessitent au moins un médicament dans votre profil.",
    setup: "Terminez cette étape", setupDescription: "Complétez votre profil avant d'utiliser ce service.", preparing: "Préparation du service",
    preparingDescription: "VYVA vérifie votre configuration pour ouvrir cette page en toute sécurité.", completeFirst: "Terminez d'abord la configuration",
    reviewPlan: "Voir le forfait", finishSetup: "Terminer la configuration", accessCheck: "Vérification d'accès VYVA",
  },
  de: {
    disabled: "Kontozugriff deaktiviert", upgrade: "Tarifwechsel erforderlich", addMedicine: "Fügen Sie zuerst ein Medikament hinzu",
    medicineRequired: "Für Medikamentenerinnerungen und Berichte muss mindestens ein Medikament in Ihrem Profil hinterlegt sein.",
    setup: "Schließen Sie diesen Schritt ab", setupDescription: "Vervollständigen Sie Ihr Profil, bevor Sie diesen Dienst nutzen.", preparing: "Dienst wird vorbereitet",
    preparingDescription: "VYVA prüft Ihre Einrichtung, damit diese Seite sicher geöffnet werden kann.", completeFirst: "Zuerst Einrichtung abschließen",
    reviewPlan: "Tarif ansehen", finishSetup: "Einrichtung abschließen", accessCheck: "VYVA-Zugriffsprüfung",
  },
  it: {
    disabled: "Accesso all'account disattivato", upgrade: "È necessario cambiare piano", addMedicine: "Aggiungi prima un farmaco",
    medicineRequired: "I promemoria e i report sui farmaci richiedono almeno un farmaco nel tuo profilo.",
    setup: "Completa questo passaggio", setupDescription: "Completa il tuo profilo prima di usare questo servizio.", preparing: "Preparazione del servizio",
    preparingDescription: "VYVA sta verificando la configurazione per aprire questa pagina in sicurezza.", completeFirst: "Completa prima la configurazione",
    reviewPlan: "Vedi il piano", finishSetup: "Completa la configurazione", accessCheck: "Verifica di accesso VYVA",
  },
  pt: {
    disabled: "Acesso à conta desativado", upgrade: "É necessário mudar de plano", addMedicine: "Adicione primeiro um medicamento",
    medicineRequired: "Os lembretes e relatórios de medicação precisam de pelo menos um medicamento no seu perfil.",
    setup: "Conclua este passo", setupDescription: "Complete o seu perfil antes de usar este serviço.", preparing: "A preparar o serviço",
    preparingDescription: "A VYVA está a verificar a configuração para abrir esta página em segurança.", completeFirst: "Conclua primeiro a configuração",
    reviewPlan: "Ver o plano", finishSetup: "Concluir a configuração", accessCheck: "Verificação de acesso VYVA",
  },
};
