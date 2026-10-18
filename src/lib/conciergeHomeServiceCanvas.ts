import { Brush, KeyRound, Lightbulb, Wrench, House } from "lucide-react";
import type { VoiceCanvasViewModel } from "@/components/voice-canvas";
import type { HomeServiceType } from "../../shared/serviceIntake";

export type ConciergeHomeServiceCanvasStep =
  | "service"
  | "description"
  | "danger"
  | "emergency"
  | "safety"
  | "urgency"
  | "time"
  | "access"
  | "location"
  | "location_custom"
  | "provider"
  | "searching"
  | "options"
  | "contact_consent"
  | "contact_method"
  | "review"
  | "paused"
  | "waiting"
  | "completed"
  | "error";

export type ConciergeHomeServiceCanvasOption = {
  id: string;
  label: string;
  description: string;
};

export type ConciergeHomeServiceContactChannel = "booking_url" | "phone" | "whatsapp" | "email" | "manual";

export type ConciergeHomeServiceCanvasCopy = ReturnType<typeof homeServiceCanvasCopy>;

export type BuildConciergeHomeServiceCanvasInput = {
  step: ConciergeHomeServiceCanvasStep;
  copy: ConciergeHomeServiceCanvasCopy;
  serviceType: HomeServiceType | null;
  description: string;
  photoName?: string;
  photoAvailable?: boolean;
  safetyAnswer?: string;
  urgency: string;
  requestedTime: string;
  accessNotes: string;
  location: string;
  hasSavedLocation?: boolean;
  savedProviderName?: string;
  options?: ConciergeHomeServiceCanvasOption[];
  selectedOption?: ConciergeHomeServiceCanvasOption | null;
  contactChannels?: Array<{ id: ConciergeHomeServiceContactChannel; label: string; description?: string; recommended?: boolean }>;
  selectedContactChannel?: ConciergeHomeServiceContactChannel | null;
  contactChannelLabel?: string;
  photoWillBeSent?: boolean;
  error?: string | null;
};

const COPY = {
  de: {
    serviceTitle: "Welche Hilfe benötigen Sie?", serviceHelper: "Wählen Sie einen Service. Sie können ihn später ändern.",
    plumber: "Klempner", electrician: "Elektriker", locksmith: "Schlüsseldienst", cleaner: "Reinigung", other: "Etwas anderes",
    descriptionTitle: "Was ist passiert?", descriptionHelper: "Beschreiben Sie VYVA das Problem. Ein Foto ist optional.", descriptionLabel: "Problem", descriptionPlaceholder: "Zum Beispiel: Unter dem Waschbecken läuft Wasser aus", addPhoto: "Foto hinzufügen", replacePhoto: "Foto ersetzen", removePhoto: "Foto entfernen", photoReady: "Foto zur Prüfung bereit", photoNeedsReattach: "Fügen Sie das Foto vor dem Teilen erneut hinzu", continue: "Weiter", back: "Zurück",
    dangerTitle: "Ist jemand in unmittelbarer Gefahr?", dangerHelper: "Zum Beispiel: Feuer, Rauch, Gas, schwere Überschwemmung, Verletzung oder Aussperren unter gefährlichen Bedingungen.", dangerYes: "Ja, akute Gefahr", dangerNo: "Nein, alle sind sicher", dangerUnsure: "Ich bin nicht sicher", emergencyTitle: "Holen Sie jetzt dringend Hilfe", emergencyHelper: "Warten Sie nicht auf einen Dienstleister. Rufen Sie den Notdienst und verlassen Sie den Gefahrenbereich, wenn das sicher möglich ist.", callEmergency: "Notdienst anrufen", safeNow: "Ich bin jetzt in Sicherheit",
    safetyTitle: "Eine kurze Sicherheitsfrage", safetyHelpers: { plumber: "Tritt viel Wasser aus oder ist es in der Nähe von Strom?", electrician: "Gibt es Funken, Rauch, Hitze oder Brandgeruch?", locksmith: "Ist eine schutzbedürftige Person ein- oder ausgesperrt?", cleaner: "Gibt es Glasscherben, verschüttete Chemikalien oder andere Gefahren?", other: "Gibt es Gefahren, die VYVA kennen sollte?" }, safetyYes: "Ja", safetyNo: "Nein", safetyUnsure: "Nicht sicher",
    urgencyTitle: "Wie schnell benötigen Sie Hilfe?", urgencyHelper: "So kann VYVA die Verfügbarkeit prüfen.", now: "Jetzt", today: "Heute", thisWeek: "Diese Woche", flexible: "Ich bin flexibel",
    timeTitle: "Welche Uhrzeit passt Ihnen?", timeHelper: "Nennen Sie eine Uhrzeit oder einen Zeitraum.", timeLabel: "Gewünschte Zeit", timePlaceholder: "Zum Beispiel: morgen Vormittag",
    accessTitle: "Was sollte der Anbieter noch wissen?", accessHelper: "Optional: Zugang, Parken, Haustiere, Treppen oder Mobilität.", accessLabel: "Zugangshinweise", accessPlaceholder: "Zum Beispiel: am Seiteneingang klingeln", skip: "Überspringen",
    locationTitle: "Wo findet der Besuch statt?", locationHelper: "Verwenden Sie Ihre gespeicherte Adresse oder eine andere.", savedHome: "Gespeicherte Wohnadresse verwenden", anotherAddress: "Andere Adresse", locationLabel: "Besuchsadresse", locationPlaceholder: "Adresse eingeben",
    providerTitle: "Wen soll VYVA prüfen?", providerHelper: "Wählen Sie einen vertrauten Anbieter oder vergleichen Sie neue Optionen.", compareProviders: "Neue Anbieter vergleichen", compareDescription: "Verfügbarkeit, Preis, Entfernung und Bewertungen prüfen", addProvider: "Vertrauten Anbieter hinzufügen", savedProviderDescription: "In Ihrem Profil gespeichert",
    searchingTitle: "Passende Anbieter werden gesucht", searchingHelper: "VYVA sucht nach nachvollziehbaren Informationen.", optionsTitle: "Wählen Sie eine Option zur Prüfung", optionsHelper: "Unbekannte oder ungeprüfte Angaben bleiben gekennzeichnet.",
    reviewTitle: "Prüfen Sie die zu teilenden Angaben", reviewHelper: "Ohne Ihre Bestätigung erfolgen keine Anrufe, Nachrichten, Buchungen oder Datenweitergaben.", service: "Service", problem: "Problem", urgency: "Dringlichkeit", preferredTime: "Gewünschte Zeit", visitAddress: "Adresse", accessNotes: "Zugang", provider: "Anbieter", contactRoute: "Kontaktweg", photo: "Foto", photoSent: "An die E-Mail an den Anbieter angehängt", photoNotSent: "Bleibt privat; wird auf diesem Weg nicht gesendet", noPhoto: "Kein Foto", unknown: "Nicht angegeben", confirm: "Bestätigen und Kontakt vorbereiten", change: "Angaben ändern",
    waitingTitle: "Nächster Schritt wird vorbereitet", waitingHelper: "VYVA verwendet nur die von Ihnen bestätigten Angaben.", completedTitle: "Anfrage vorbereitet", completedHelper: "Sie können die Antwort unter Jetzt verfolgen.", errorTitle: "Dieser Schritt erfordert Ihre Aufmerksamkeit", tryAgain: "Erneut versuchen",
  },
  it: {
    serviceTitle: "Di quale aiuto hai bisogno?", serviceHelper: "Scegli un servizio. Potrai cambiarlo in seguito.",
    plumber: "Idraulico", electrician: "Elettricista", locksmith: "Fabbro", cleaner: "Pulizie", other: "Altro servizio",
    descriptionTitle: "Cosa sta succedendo?", descriptionHelper: "Descrivi il problema a VYVA. La foto è facoltativa.", descriptionLabel: "Problema", descriptionPlaceholder: "Per esempio: perde acqua sotto il lavandino", addPhoto: "Aggiungi foto", replacePhoto: "Sostituisci foto", removePhoto: "Rimuovi foto", photoReady: "Foto pronta da verificare", photoNeedsReattach: "Aggiungi di nuovo la foto prima di condividerla", continue: "Continua", back: "Indietro",
    dangerTitle: "Qualcuno è in pericolo immediato?", dangerHelper: "Per esempio: incendio, fumo, gas, grave allagamento, ferite o essere chiusi fuori in condizioni pericolose.", dangerYes: "Sì, pericolo immediato", dangerNo: "No, tutti sono al sicuro", dangerUnsure: "Non so", emergencyTitle: "Chiedi subito aiuto urgente", emergencyHelper: "Non aspettare un fornitore. Contatta i soccorsi e allontanati dal pericolo se puoi farlo in sicurezza.", callEmergency: "Chiama i soccorsi", safeNow: "Ora sono al sicuro",
    safetyTitle: "Una breve verifica di sicurezza", safetyHelpers: { plumber: "C’è un allagamento o acqua vicino all’elettricità?", electrician: "Ci sono scintille, fumo, calore o odore di bruciato?", locksmith: "Una persona vulnerabile è chiusa dentro o fuori?", cleaner: "Ci sono vetri rotti, sostanze chimiche versate o altri pericoli?", other: "Ci sono pericoli che VYVA dovrebbe conoscere?" }, safetyYes: "Sì", safetyNo: "No", safetyUnsure: "Non so",
    urgencyTitle: "Quando hai bisogno di aiuto?", urgencyHelper: "Questo permette a VYVA di verificare le disponibilità.", now: "Ora", today: "Oggi", thisWeek: "Questa settimana", flexible: "Sono flessibile",
    timeTitle: "Quale orario preferisci?", timeHelper: "Indica un’ora o una fascia oraria.", timeLabel: "Orario preferito", timePlaceholder: "Per esempio: domani mattina",
    accessTitle: "Il fornitore deve sapere altro?", accessHelper: "Facoltativo: accesso, parcheggio, animali, scale o mobilità.", accessLabel: "Note di accesso", accessPlaceholder: "Per esempio: suonare all’ingresso laterale", skip: "Salta",
    locationTitle: "Dove avverrà l’intervento?", locationHelper: "Usa il tuo indirizzo salvato o inseriscine un altro.", savedHome: "Usa il mio indirizzo salvato", anotherAddress: "Altro indirizzo", locationLabel: "Indirizzo dell’intervento", locationPlaceholder: "Inserisci l’indirizzo",
    providerTitle: "Chi deve consultare VYVA?", providerHelper: "Scegli qualcuno di fiducia o confronta nuove opzioni.", compareProviders: "Confronta nuovi fornitori", compareDescription: "Verifica disponibilità, prezzo, distanza e reputazione", addProvider: "Aggiungi un fornitore di fiducia", savedProviderDescription: "Salvato nel tuo profilo",
    searchingTitle: "Ricerca di fornitori adatti", searchingHelper: "VYVA cerca informazioni che potrai esaminare.", optionsTitle: "Scegli un’opzione da esaminare", optionsHelper: "I dettagli sconosciuti o non verificati restano segnalati.",
    reviewTitle: "Verifica cosa verrà condiviso", reviewHelper: "Nessuna chiamata, messaggio, prenotazione o condivisione senza la tua conferma.", service: "Servizio", problem: "Problema", urgency: "Urgenza", preferredTime: "Orario preferito", visitAddress: "Indirizzo", accessNotes: "Accesso", provider: "Fornitore", contactRoute: "Metodo di contatto", photo: "Foto", photoSent: "Allegata all’email al fornitore", photoNotSent: "Privata; non inviata tramite questo canale", noPhoto: "Nessuna foto", unknown: "Non indicato", confirm: "Conferma e prepara il contatto", change: "Modifica i dettagli",
    waitingTitle: "Preparazione del prossimo passo", waitingHelper: "VYVA usa solo i dettagli che hai approvato.", completedTitle: "Richiesta preparata", completedHelper: "Puoi seguire la risposta nella sezione Adesso.", errorTitle: "Questo passaggio richiede attenzione", tryAgain: "Riprova",
  },
  pt: {
    serviceTitle: "De que ajuda precisa?", serviceHelper: "Escolha um serviço. Pode alterá-lo depois.",
    plumber: "Canalizador", electrician: "Eletricista", locksmith: "Chaveiro", cleaner: "Limpeza", other: "Outro serviço",
    descriptionTitle: "O que está a acontecer?", descriptionHelper: "Descreva o problema à VYVA. A fotografia é opcional.", descriptionLabel: "Problema", descriptionPlaceholder: "Por exemplo: há uma fuga de água debaixo do lava-loiça", addPhoto: "Adicionar fotografia", replacePhoto: "Substituir fotografia", removePhoto: "Remover fotografia", photoReady: "Fotografia pronta para verificar", photoNeedsReattach: "Adicione novamente a fotografia antes de a partilhar", continue: "Continuar", back: "Voltar",
    dangerTitle: "Alguém está em perigo imediato?", dangerHelper: "Por exemplo: incêndio, fumo, gás, inundação grave, ferimentos ou alguém fechado fora em condições perigosas.", dangerYes: "Sim, perigo imediato", dangerNo: "Não, todos estão seguros", dangerUnsure: "Não sei", emergencyTitle: "Peça ajuda urgente agora", emergencyHelper: "Não espere por um prestador. Contacte os serviços de emergência e afaste-se do perigo se o puder fazer em segurança.", callEmergency: "Ligar para a emergência", safeNow: "Agora estou em segurança",
    safetyTitle: "Uma breve verificação de segurança", safetyHelpers: { plumber: "Há inundação ou água perto de eletricidade?", electrician: "Há faíscas, fumo, calor ou cheiro a queimado?", locksmith: "Há uma pessoa vulnerável fechada dentro ou fora?", cleaner: "Há vidros partidos, produtos químicos derramados ou outro perigo?", other: "Há algum perigo que a VYVA deva conhecer?" }, safetyYes: "Sim", safetyNo: "Não", safetyUnsure: "Não sei",
    urgencyTitle: "Quando precisa de ajuda?", urgencyHelper: "Isto permite à VYVA verificar a disponibilidade.", now: "Agora", today: "Hoje", thisWeek: "Esta semana", flexible: "Sou flexível",
    timeTitle: "Que horário prefere?", timeHelper: "Indique uma hora ou um período.", timeLabel: "Horário preferido", timePlaceholder: "Por exemplo: amanhã de manhã",
    accessTitle: "O prestador deve saber mais alguma coisa?", accessHelper: "Opcional: acesso, estacionamento, animais, escadas ou mobilidade.", accessLabel: "Notas de acesso", accessPlaceholder: "Por exemplo: tocar à campainha lateral", skip: "Ignorar",
    locationTitle: "Onde será a visita?", locationHelper: "Use a morada guardada ou introduza outra.", savedHome: "Usar a minha morada guardada", anotherAddress: "Outra morada", locationLabel: "Morada da visita", locationPlaceholder: "Introduza a morada",
    providerTitle: "Quem deve a VYVA consultar?", providerHelper: "Escolha alguém de confiança ou compare novas opções.", compareProviders: "Comparar novos prestadores", compareDescription: "Verificar disponibilidade, preço, distância e reputação", addProvider: "Adicionar prestador de confiança", savedProviderDescription: "Guardado no seu perfil",
    searchingTitle: "A procurar prestadores adequados", searchingHelper: "A VYVA procura informações que poderá analisar.", optionsTitle: "Escolha uma opção para analisar", optionsHelper: "Os dados desconhecidos ou não verificados continuam identificados.",
    reviewTitle: "Verifique o que será partilhado", reviewHelper: "Não são feitas chamadas, mensagens, reservas ou partilhas sem a sua confirmação.", service: "Serviço", problem: "Problema", urgency: "Urgência", preferredTime: "Horário preferido", visitAddress: "Morada", accessNotes: "Acesso", provider: "Prestador", contactRoute: "Meio de contacto", photo: "Fotografia", photoSent: "Anexada ao email para o prestador", photoNotSent: "Privada; não enviada por este meio", noPhoto: "Sem fotografia", unknown: "Não indicado", confirm: "Confirmar e preparar contacto", change: "Alterar dados",
    waitingTitle: "A preparar o próximo passo", waitingHelper: "A VYVA usa apenas os dados que aprovou.", completedTitle: "Pedido preparado", completedHelper: "Pode acompanhar a resposta na secção Agora.", errorTitle: "Este passo precisa de atenção", tryAgain: "Tentar novamente",
  },
  fr: {
    serviceTitle: "De quelle aide avez-vous besoin ?", serviceHelper: "Choisissez un service. Vous pourrez le modifier ensuite.",
    plumber: "Plombier", electrician: "Électricien", locksmith: "Serrurier", cleaner: "Ménage", other: "Autre service",
    descriptionTitle: "Que se passe-t-il ?", descriptionHelper: "Expliquez le problème à VYVA. Une photo est facultative.", descriptionLabel: "Problème", descriptionPlaceholder: "Par exemple : de l’eau fuit sous l’évier", addPhoto: "Ajouter une photo", replacePhoto: "Remplacer la photo", removePhoto: "Supprimer la photo", photoReady: "Photo prête à vérifier", photoNeedsReattach: "Ajoutez à nouveau la photo avant de la partager", continue: "Continuer", back: "Retour",
    dangerTitle: "Quelqu’un est-il en danger immédiat ?", dangerHelper: "Par exemple : incendie, fumée, gaz, inondation importante, blessure ou personne bloquée dehors dans des conditions dangereuses.", dangerYes: "Oui, danger immédiat", dangerNo: "Non, tout le monde est en sécurité", dangerUnsure: "Je ne sais pas", emergencyTitle: "Demandez une aide urgente", emergencyHelper: "N’attendez pas un prestataire. Contactez les secours et éloignez-vous du danger si vous pouvez le faire sans risque.", callEmergency: "Appeler les secours", safeNow: "Je suis en sécurité maintenant",
    safetyTitle: "Une vérification de sécurité", safetyHelpers: { plumber: "Y a-t-il une inondation ou de l’eau près de l’électricité ?", electrician: "Y a-t-il des étincelles, de la fumée, de la chaleur ou une odeur de brûlé ?", locksmith: "Une personne vulnérable est-elle enfermée ou bloquée dehors ?", cleaner: "Y a-t-il du verre cassé, un produit chimique renversé ou un autre danger ?", other: "Y a-t-il un danger que VYVA doit connaître ?" }, safetyYes: "Oui", safetyNo: "Non", safetyUnsure: "Je ne sais pas",
    urgencyTitle: "Quand avez-vous besoin d’aide ?", urgencyHelper: "VYVA pourra ainsi vérifier les disponibilités.", now: "Maintenant", today: "Aujourd’hui", thisWeek: "Cette semaine", flexible: "Je suis flexible",
    timeTitle: "Quel horaire vous convient ?", timeHelper: "Indiquez une heure ou un créneau.", timeLabel: "Horaire souhaité", timePlaceholder: "Par exemple : demain matin",
    accessTitle: "Le prestataire doit-il savoir autre chose ?", accessHelper: "Facultatif : accès, stationnement, animaux, escaliers ou mobilité.", accessLabel: "Informations d’accès", accessPlaceholder: "Par exemple : sonner à l’entrée latérale", skip: "Passer",
    locationTitle: "Où aura lieu l’intervention ?", locationHelper: "Utilisez votre adresse enregistrée ou une autre adresse.", savedHome: "Utiliser mon adresse enregistrée", anotherAddress: "Autre adresse", locationLabel: "Adresse de l’intervention", locationPlaceholder: "Saisissez l’adresse",
    providerTitle: "Qui VYVA doit-il consulter ?", providerHelper: "Choisissez une personne de confiance ou comparez de nouveaux prestataires.", compareProviders: "Comparer de nouveaux prestataires", compareDescription: "Vérifier disponibilité, prix, distance et réputation", addProvider: "Ajouter un prestataire de confiance", savedProviderDescription: "Enregistré dans votre profil",
    searchingTitle: "Recherche de prestataires adaptés", searchingHelper: "VYVA recherche des informations que vous pourrez examiner.",
    optionsTitle: "Choisissez une option à examiner", optionsHelper: "Les informations inconnues ou non vérifiées restent signalées.",
    reviewTitle: "Vérifiez les informations à partager", reviewHelper: "Aucun appel, message, réservation ou partage sans votre confirmation.", service: "Service", problem: "Problème", urgency: "Urgence", preferredTime: "Horaire souhaité", visitAddress: "Adresse", accessNotes: "Accès", provider: "Prestataire", contactRoute: "Moyen de contact", photo: "Photo", photoSent: "Jointe au courriel du prestataire", photoNotSent: "Privée ; non envoyée par ce moyen", noPhoto: "Aucune photo", unknown: "Non renseigné", confirm: "Confirmer et préparer le contact", change: "Modifier les informations",
    waitingTitle: "Préparation de la prochaine étape", waitingHelper: "VYVA utilise uniquement les informations approuvées.", completedTitle: "Demande préparée", completedHelper: "Vous pouvez suivre la réponse dans la rubrique En ce moment.", errorTitle: "Cette étape nécessite votre attention", tryAgain: "Réessayer",
  },
  en: {
    serviceTitle: "What kind of help do you need?", serviceHelper: "Choose one. You can change it later.",
    plumber: "Plumber", electrician: "Electrician", locksmith: "Locksmith", cleaner: "Cleaning", other: "Something else",
    descriptionTitle: "What is happening?", descriptionHelper: "Tell VYVA in your own words. A photo is optional.", descriptionLabel: "Problem", descriptionPlaceholder: "For example: water is leaking under the sink", addPhoto: "Add a photo", replacePhoto: "Replace photo", removePhoto: "Remove photo", photoReady: "Photo ready for review", photoNeedsReattach: "Add the photo again before it can be shared", continue: "Continue", back: "Back",
    dangerTitle: "Is anyone in immediate danger?", dangerHelper: "For example: fire, smoke, gas, serious flooding, injury, or being locked outside in unsafe conditions.", dangerYes: "Yes, danger now", dangerNo: "No, everyone is safe", dangerUnsure: "I am not sure", emergencyTitle: "Get urgent help now", emergencyHelper: "Do not wait for a home service provider. Contact emergency services and move away from danger if you can do so safely.", callEmergency: "Call emergency services", safeNow: "I am safe now",
    safetyTitle: "One quick safety check", safetyHelpers: { plumber: "Is water actively flooding or near electricity?", electrician: "Are there sparks, smoke, heat, or a burning smell?", locksmith: "Is anyone vulnerable locked in or outside?", cleaner: "Is there broken glass, a chemical spill, or another hazard?", other: "Is there anything unsafe that VYVA should know?" }, safetyYes: "Yes", safetyNo: "No", safetyUnsure: "Not sure",
    urgencyTitle: "How soon do you need help?", urgencyHelper: "This helps VYVA check realistic availability.", now: "Now", today: "Today", thisWeek: "This week", flexible: "I am flexible",
    timeTitle: "What time works best?", timeHelper: "Say a time or a simple window.", timeLabel: "Preferred time", timePlaceholder: "For example: tomorrow morning",
    accessTitle: "Anything the provider should know?", accessHelper: "Optional. Add access, parking, pets, stairs, or mobility notes.", accessLabel: "Access notes", accessPlaceholder: "For example: ring the side entrance bell", skip: "Skip",
    locationTitle: "Where is the visit?", locationHelper: "Use your saved home or enter another address.", savedHome: "Use my saved home", anotherAddress: "Another address", locationLabel: "Visit address", locationPlaceholder: "Enter the address",
    providerTitle: "Who should VYVA check?", providerHelper: "Use someone you trust or compare new options.", compareProviders: "Compare new providers", compareDescription: "Check availability, price, distance, and reputation", addProvider: "Add a trusted provider", savedProviderDescription: "Saved in your profile",
    searchingTitle: "Checking suitable providers", searchingHelper: "VYVA is looking for clear, reviewable information.",
    optionsTitle: "Choose an option to review", optionsHelper: "Unknown or unverified details stay clearly labelled.",
    reviewTitle: "Check what will be shared", reviewHelper: "Nothing is called, messaged, booked, or shared until you confirm.", service: "Service", problem: "Problem", urgency: "Urgency", preferredTime: "Preferred time", visitAddress: "Visit address", accessNotes: "Access notes", provider: "Provider", contactRoute: "Contact route", photo: "Photo", photoSent: "Attached to the provider email", photoNotSent: "Kept private; not sent on this route", noPhoto: "No photo", unknown: "Not provided", confirm: "Confirm and prepare contact", change: "Change details",
    waitingTitle: "Preparing the next step", waitingHelper: "VYVA is using only the details you approved.", completedTitle: "Request prepared", completedHelper: "You can follow the provider response in Right now.", errorTitle: "This step needs attention", tryAgain: "Try again",
  },
  es: {
    serviceTitle: "¿Qué tipo de ayuda necesitas?", serviceHelper: "Elige una. Puedes cambiarla después.",
    plumber: "Fontanero", electrician: "Electricista", locksmith: "Cerrajero", cleaner: "Limpieza", other: "Otro servicio",
    descriptionTitle: "¿Qué está pasando?", descriptionHelper: "Cuéntaselo a VYVA con tus palabras. La foto es opcional.", descriptionLabel: "Problema", descriptionPlaceholder: "Por ejemplo: sale agua debajo del fregadero", addPhoto: "Añadir foto", replacePhoto: "Cambiar foto", removePhoto: "Quitar foto", photoReady: "Foto lista para revisar", photoNeedsReattach: "Añade la foto de nuevo antes de poder compartirla", continue: "Continuar", back: "Volver",
    dangerTitle: "¿Hay alguien en peligro inmediato?", dangerHelper: "Por ejemplo: fuego, humo, gas, inundación grave, lesión o estar fuera de casa en condiciones inseguras.", dangerYes: "Sí, hay peligro", dangerNo: "No, todos están seguros", dangerUnsure: "No estoy seguro", emergencyTitle: "Busca ayuda urgente ahora", emergencyHelper: "No esperes a un proveedor. Contacta con emergencias y aléjate del peligro si puedes hacerlo con seguridad.", callEmergency: "Llamar a emergencias", safeNow: "Ahora estoy a salvo",
    safetyTitle: "Una comprobación de seguridad", safetyHelpers: { plumber: "¿Sale mucha agua o está cerca de electricidad?", electrician: "¿Hay chispas, humo, calor u olor a quemado?", locksmith: "¿Hay una persona vulnerable encerrada o fuera?", cleaner: "¿Hay cristales, productos químicos u otro peligro?", other: "¿Hay algo inseguro que VYVA deba saber?" }, safetyYes: "Sí", safetyNo: "No", safetyUnsure: "No estoy seguro",
    urgencyTitle: "¿Cuándo necesitas ayuda?", urgencyHelper: "Así VYVA puede comprobar disponibilidad real.", now: "Ahora", today: "Hoy", thisWeek: "Esta semana", flexible: "Soy flexible",
    timeTitle: "¿Qué hora te viene bien?", timeHelper: "Di una hora o una franja sencilla.", timeLabel: "Hora preferida", timePlaceholder: "Por ejemplo: mañana por la mañana",
    accessTitle: "¿Debe saber algo el proveedor?", accessHelper: "Opcional. Añade acceso, aparcamiento, mascotas, escaleras o movilidad.", accessLabel: "Notas de acceso", accessPlaceholder: "Por ejemplo: llamar al timbre lateral", skip: "Omitir",
    locationTitle: "¿Dónde es la visita?", locationHelper: "Usa tu casa guardada o añade otra dirección.", savedHome: "Usar mi casa guardada", anotherAddress: "Otra dirección", locationLabel: "Dirección de la visita", locationPlaceholder: "Escribe la dirección",
    providerTitle: "¿A quién debe consultar VYVA?", providerHelper: "Usa alguien de confianza o compara opciones nuevas.", compareProviders: "Comparar proveedores nuevos", compareDescription: "Comprobar disponibilidad, precio, distancia y reputación", addProvider: "Añadir proveedor de confianza", savedProviderDescription: "Guardado en tu perfil",
    searchingTitle: "Buscando proveedores adecuados", searchingHelper: "VYVA busca información clara y revisable.",
    optionsTitle: "Elige una opción para revisar", optionsHelper: "Los datos desconocidos o no verificados se muestran claramente.",
    reviewTitle: "Revisa lo que se compartirá", reviewHelper: "Nada se llama, envía, reserva ni comparte hasta que confirmes.", service: "Servicio", problem: "Problema", urgency: "Urgencia", preferredTime: "Hora preferida", visitAddress: "Dirección", accessNotes: "Acceso", provider: "Proveedor", contactRoute: "Vía de contacto", photo: "Foto", photoSent: "Adjunta al correo del proveedor", photoNotSent: "Se mantiene privada; no se envía por esta vía", noPhoto: "Sin foto", unknown: "No indicado", confirm: "Confirmar y preparar contacto", change: "Cambiar datos",
    waitingTitle: "Preparando el siguiente paso", waitingHelper: "VYVA usa solo los datos que has aprobado.", completedTitle: "Solicitud preparada", completedHelper: "Puedes seguir la respuesta en Ahora mismo.", errorTitle: "Este paso necesita atención", tryAgain: "Intentar de nuevo",
  },
} as const;

const CONTACT_COPY = {
  de: { consentTitle: "Soll VYVA diesen Anbieter kontaktieren?", consentHelper: "Die Auswahl des Anbieters erlaubt noch keinen Kontakt.", consentYes: "Ja, kontaktieren", consentNotNow: "Nicht jetzt", consentChange: "Anderen Anbieter wählen", methodTitle: "Wie soll VYVA Kontakt aufnehmen?", methodHelper: "Wählen Sie einen verfügbaren Kontaktweg.", recommended: "Empfohlen", pausedTitle: "Für später gespeichert", pausedHelper: "Es wurde kein Anbieter kontaktiert. Sie können diese Aufgabe später fortsetzen.", confirmContact: "Bestätigen und Anbieter kontaktieren" },
  it: { consentTitle: "Vuoi che VYVA contatti questo fornitore?", consentHelper: "La scelta del fornitore non autorizza ancora alcun contatto.", consentYes: "Sì, contattalo", consentNotNow: "Non ora", consentChange: "Scegli un altro fornitore", methodTitle: "Come deve contattarlo VYVA?", methodHelper: "Scegli un metodo disponibile.", recommended: "Consigliato", pausedTitle: "Salvato per dopo", pausedHelper: "Nessun fornitore è stato contattato. Puoi riprendere questa attività in seguito.", confirmContact: "Conferma e contatta il fornitore" },
  pt: { consentTitle: "Quer que a VYVA contacte este prestador?", consentHelper: "Escolher o prestador ainda não autoriza qualquer contacto.", consentYes: "Sim, contactar", consentNotNow: "Agora não", consentChange: "Escolher outro prestador", methodTitle: "Como deve a VYVA contactar?", methodHelper: "Escolha um meio de contacto disponível.", recommended: "Recomendado", pausedTitle: "Guardado para mais tarde", pausedHelper: "Nenhum prestador foi contactado. Pode retomar esta tarefa mais tarde.", confirmContact: "Confirmar e contactar prestador" },
  fr: { consentTitle: "Souhaitez-vous que VYVA contacte ce prestataire ?", consentHelper: "Choisir le prestataire n’autorise pas encore le contact.", consentYes: "Oui, le contacter", consentNotNow: "Pas maintenant", consentChange: "Choisir un autre prestataire", methodTitle: "Comment VYVA doit-il le contacter ?", methodHelper: "Choisissez un moyen de contact disponible.", recommended: "Recommandé", pausedTitle: "Enregistré pour plus tard", pausedHelper: "Aucun prestataire n’a été contacté. Vous pourrez reprendre cette tâche plus tard.", confirmContact: "Confirmer et contacter le prestataire" },
  en: { consentTitle: "Would you like VYVA to contact this provider?", consentHelper: "Choosing a provider does not give permission to contact them.", consentYes: "Yes, contact them", consentNotNow: "Not now", consentChange: "Choose another provider", methodTitle: "How should VYVA contact them?", methodHelper: "Choose one of the available contact methods.", recommended: "Recommended", pausedTitle: "Saved for later", pausedHelper: "No provider was contacted. You can resume this task later.", confirmContact: "Confirm and contact provider" },
  es: { consentTitle: "¿Quieres que VYVA contacte con este proveedor?", consentHelper: "Elegir el proveedor todavía no autoriza ningún contacto.", consentYes: "Sí, contactar", consentNotNow: "Ahora no", consentChange: "Elegir otro proveedor", methodTitle: "¿Cómo debe contactar VYVA?", methodHelper: "Elige una vía de contacto disponible.", recommended: "Recomendado", pausedTitle: "Guardado para más tarde", pausedHelper: "No se ha contactado con ningún proveedor. Puedes retomar esta tarea más tarde.", confirmContact: "Confirmar y contactar proveedor" },
} as const;

export function homeServiceCanvasCopy(locale: string) {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const key = Object.prototype.hasOwnProperty.call(COPY, language) ? language as keyof typeof COPY : "en";
  return { ...COPY[key], ...CONTACT_COPY[key] };
}

function progress(current: number) {
  return { current, total: 8, label: `${current} / 8` };
}

function serviceLabel(type: HomeServiceType | null, copy: ConciergeHomeServiceCanvasCopy) {
  if (type === "plumber") return copy.plumber;
  if (type === "electrician") return copy.electrician;
  if (type === "locksmith") return copy.locksmith;
  if (type === "cleaner") return copy.cleaner;
  return copy.other;
}

export function buildConciergeHomeServiceCanvasViewModel(input: BuildConciergeHomeServiceCanvasInput): VoiceCanvasViewModel {
  const { step, copy } = input;
  if (step === "service") return {
    sceneId: "home-service-type", kind: "choice", title: copy.serviceTitle, helperText: copy.serviceHelper, progress: progress(1),
    choices: [
      { id: "plumber", label: copy.plumber, icon: Wrench },
      { id: "electrician", label: copy.electrician, icon: Lightbulb },
      { id: "locksmith", label: copy.locksmith, icon: KeyRound },
      { id: "cleaner", label: copy.cleaner, icon: Brush },
      { id: "other", label: copy.other, icon: House },
    ],
  };
  if (step === "description") return {
    sceneId: "home-service-description", kind: "text-entry", title: copy.descriptionTitle, helperText: copy.descriptionHelper, progress: progress(2),
    textEntry: { label: copy.descriptionLabel, value: input.description, placeholder: copy.descriptionPlaceholder, multiline: true, maxLength: 700 },
    fileEntry: {
      label: input.photoAvailable ? copy.replacePhoto : copy.addPhoto,
      accept: "image/*",
      capture: "environment",
      fileName: input.photoAvailable ? input.photoName : undefined,
      statusLabel: input.photoAvailable ? copy.photoReady : input.photoName ? copy.photoNeedsReattach : undefined,
      removeLabel: copy.removePhoto,
    },
    primaryAction: { label: copy.continue, disabled: !input.description.trim() }, secondaryAction: { label: copy.back },
  };
  if (step === "danger") return {
    sceneId: "home-service-danger", kind: "choice", title: copy.dangerTitle, helperText: copy.dangerHelper, progress: progress(3),
    choices: [{ id: "yes", label: copy.dangerYes }, { id: "no", label: copy.dangerNo }, { id: "not_sure", label: copy.dangerUnsure }], secondaryAction: { label: copy.back },
  };
  if (step === "emergency") return {
    sceneId: "home-service-emergency", kind: "blocked", title: copy.emergencyTitle, helperText: copy.emergencyHelper, status: "blocked",
    primaryAction: { label: copy.callEmergency }, secondaryAction: { label: copy.safeNow },
  };
  if (step === "safety") return {
    sceneId: "home-service-safety", kind: "choice", title: copy.safetyTitle,
    helperText: copy.safetyHelpers[input.serviceType === "plumber" || input.serviceType === "electrician" || input.serviceType === "locksmith" || input.serviceType === "cleaner" ? input.serviceType : "other"], progress: progress(3),
    choices: [{ id: "yes", label: copy.safetyYes }, { id: "no", label: copy.safetyNo }, { id: "not_sure", label: copy.safetyUnsure }], secondaryAction: { label: copy.back },
  };
  if (step === "urgency") return {
    sceneId: "home-service-urgency", kind: "choice", title: copy.urgencyTitle, helperText: copy.urgencyHelper, progress: progress(4),
    choices: [{ id: "now", label: copy.now }, { id: "today", label: copy.today }, { id: "this_week", label: copy.thisWeek }, { id: "flexible", label: copy.flexible }], secondaryAction: { label: copy.back },
  };
  if (step === "time") return {
    sceneId: "home-service-time", kind: "text-entry", title: copy.timeTitle, helperText: copy.timeHelper, progress: progress(5),
    textEntry: { label: copy.timeLabel, value: input.requestedTime, placeholder: copy.timePlaceholder, maxLength: 160 }, primaryAction: { label: copy.continue, disabled: !input.requestedTime.trim() }, secondaryAction: { label: copy.back },
  };
  if (step === "access") return {
    sceneId: "home-service-access", kind: "text-entry", title: copy.accessTitle, helperText: copy.accessHelper, progress: progress(6),
    textEntry: { label: copy.accessLabel, value: input.accessNotes, placeholder: copy.accessPlaceholder, multiline: true, maxLength: 500 }, primaryAction: { label: copy.continue }, secondaryAction: { label: copy.skip },
  };
  if (step === "location") return {
    sceneId: "home-service-location", kind: "place", title: copy.locationTitle, helperText: copy.locationHelper, progress: progress(7),
    choices: [
      ...(input.hasSavedLocation ? [{ id: "saved_home", label: copy.savedHome }] : []),
      { id: "another_address", label: copy.anotherAddress },
    ], secondaryAction: { label: copy.back },
  };
  if (step === "location_custom") return {
    sceneId: "home-service-location-custom", kind: "text-entry", title: copy.locationTitle, helperText: copy.locationHelper, progress: progress(7),
    textEntry: { label: copy.locationLabel, value: input.location, placeholder: copy.locationPlaceholder, maxLength: 500 }, primaryAction: { label: copy.continue, disabled: !input.location.trim() }, secondaryAction: { label: copy.back },
  };
  if (step === "provider") return {
    sceneId: "home-service-provider", kind: "choice", title: copy.providerTitle, helperText: copy.providerHelper, progress: progress(8),
    choices: [
      ...(input.savedProviderName ? [{ id: "saved_provider", label: input.savedProviderName, description: copy.savedProviderDescription }] : []),
      { id: "compare_providers", label: copy.compareProviders, description: copy.compareDescription },
      ...(!input.savedProviderName ? [{ id: "add_provider", label: copy.addProvider }] : []),
    ], secondaryAction: { label: copy.back },
  };
  if (step === "searching") return { sceneId: "home-service-searching", kind: "waiting", title: copy.searchingTitle, helperText: copy.searchingHelper, status: "loading" };
  if (step === "options") return {
    sceneId: "home-service-options", kind: "choice", title: copy.optionsTitle, helperText: copy.optionsHelper,
    choices: (input.options ?? []).map((option) => ({ id: option.id, label: option.label, description: option.description })), secondaryAction: { label: copy.back },
  };
  if (step === "contact_consent") return {
    sceneId: "home-service-contact-consent", kind: "choice", title: copy.consentTitle, helperText: copy.consentHelper,
    choices: [
      { id: "contact_yes", label: copy.consentYes },
      { id: "contact_not_now", label: copy.consentNotNow },
      { id: "contact_change_provider", label: copy.consentChange },
    ],
  };
  if (step === "contact_method") return {
    sceneId: "home-service-contact-method", kind: "choice", title: copy.methodTitle, helperText: copy.methodHelper,
    choices: (input.contactChannels ?? []).map((channel) => ({
      id: channel.id,
      label: channel.label,
      description: channel.description ?? (channel.recommended ? copy.recommended : undefined),
    })),
    secondaryAction: { label: copy.back },
  };
  if (step === "review") return {
    sceneId: "home-service-review", kind: "review", title: copy.reviewTitle, helperText: copy.reviewHelper,
    summaryRows: [
      { id: "service", label: copy.service, value: serviceLabel(input.serviceType, copy) },
      { id: "problem", label: copy.problem, value: input.description },
      { id: "urgency", label: copy.urgency, value: input.urgency || copy.unknown },
      { id: "time", label: copy.preferredTime, value: input.requestedTime || copy.unknown },
      { id: "location", label: copy.visitAddress, value: input.location || copy.unknown },
      { id: "access", label: copy.accessNotes, value: input.accessNotes || copy.unknown },
      { id: "provider", label: copy.provider, value: input.selectedOption?.label || input.savedProviderName || copy.unknown },
      { id: "channel", label: copy.contactRoute, value: input.contactChannelLabel || copy.unknown },
      {
        id: "photo",
        label: copy.photo,
        value: input.photoName
          ? !input.photoAvailable
            ? copy.photoNeedsReattach
            : input.photoWillBeSent
              ? copy.photoSent
              : copy.photoNotSent
          : copy.noPhoto,
      },
    ], primaryAction: { label: copy.confirmContact, disabled: !input.selectedOption || !input.selectedContactChannel }, secondaryAction: { label: copy.change },
  };
  if (step === "waiting") return { sceneId: "home-service-waiting", kind: "waiting", title: copy.waitingTitle, helperText: copy.waitingHelper, status: "loading" };
  if (step === "paused") return { sceneId: "home-service-paused", kind: "completed", title: copy.pausedTitle, helperText: copy.pausedHelper, status: "success" };
  if (step === "completed") return { sceneId: "home-service-completed", kind: "completed", title: copy.completedTitle, helperText: copy.completedHelper, status: "success" };
  return { sceneId: "home-service-error", kind: "blocked", title: copy.errorTitle, helperText: input.error || undefined, status: "blocked", primaryAction: { label: copy.tryAgain }, secondaryAction: { label: copy.change } };
}
