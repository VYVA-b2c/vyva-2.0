import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export const DIACRITICS_MAP = {
  "auto": {
    "de": {
      "Aehnliche": "Ähnliche",
      "Aelter": "Älter",
      "Aktivitaet": "Aktivität",
      "Aktivitat": "Aktivität",
      "Anderung": "Änderung",
      "Anderungen": "Änderungen",
      "Anhoren": "Anhören",
      "Arbeitsgedachtnis": "Arbeitsgedächtnis",
      "Atemprufung": "Atemprüfung",
      "Auffaellige": "Auffällige",
      "Bedurfnisse": "Bedürfnisse",
      "Bestaetige": "Bestätige",
      "Bestaetigung": "Bestätigung",
      "Bestatigen": "Bestätigen",
      "Bestatigung": "Bestätigung",
      "Bildpruefung": "Bildprüfung",
      "Blaetter": "Blätter",
      "Bluterguesse": "Blutergüsse",
      "Einpragen": "Einprägen",
      "Einschaetzung": "Einschätzung",
      "Einschatzung": "Einschätzung",
      "Eintraege": "Einträge",
      "Erganzungen": "Ergänzungen",
      "Erklaeren": "Erklären",
      "Erklaren": "Erklären",
      "Erklarung": "Erklärung",
      "Erzaehl": "Erzähl",
      "Fachaerzte": "Fachärzte",
      "Faellig": "Fällig",
      "Fahigkeit": "Fähigkeit",
      "Fallig": "Fällig",
      "Flexibilitat": "Flexibilität",
      "Fluessigkeiten": "Flüssigkeiten",
      "Fluessigkeitsbild": "Flüssigkeitsbild",
      "Fruehaufsteher": "Frühaufsteher",
      "Frueher": "Früher",
      "Fuegen": "Fügen",
      "Gaertnern": "Gärtnern",
      "Gedachtnis": "Gedächtnis",
      "Gedachtnisfluss": "Gedächtnisfluss",
      "Gedachtnisspiel": "Gedächtnisspiel",
      "Gedaechtnis": "Gedächtnis",
      "Gefuehrter": "Geführter",
      "Gegenstanden": "Gegenständen",
      "Gehoert": "Gehört",
      "Gepruefte": "Geprüfte",
      "Gerat": "Gerät",
      "Geratekamera": "Gerätekamera",
      "Geratewert": "Gerätewert",
      "Geschaetzten": "Geschätzten",
      "Gesprach": "Gespräch",
      "Gesprachszusammenfassungen": "Gesprächszusammenfassungen",
      "Gespraech": "Gespräch",
      "Gespraeche": "Gespräche",
      "Gespraechspartner": "Gesprächspartner",
      "Gluecklich": "Glücklich",
      "Gruen": "Grün",
      "Hautveraenderungen": "Hautveränderungen",
      "Hautveranderung": "Hautveränderung",
      "Hinzufugen": "Hinzufügen",
      "Hoere": "Höre",
      "Hoeren": "Hören",
      "Horen": "Hören",
      "Kanale": "Kanäle",
      "Klaenge": "Klänge",
      "Klaengen": "Klängen",
      "Korper": "Körper",
      "Korpercheck": "Körpercheck",
      "Kuechenduft": "Küchenduft",
      "Medikamentenprufung": "Medikamentenprüfung",
      "Moeglicherweise": "Möglicherweise",
      "Moglichkeiten": "Möglichkeiten",
      "Muede": "Müde",
      "Nacherzahlung": "Nacherzählung",
      "Nachste": "Nächste",
      "Nachsten": "Nächsten",
      "Nachster": "Nächster",
      "Nachstes": "Nächstes",
      "Naechste": "Nächste",
      "Naechsten": "Nächsten",
      "Naechster": "Nächster",
      "Naechstes": "Nächstes",
      "Naehe": "Nähe",
      "Nahrungsergaenzungen": "Nahrungsergänzungen",
      "Nutzliche": "Nützliche",
      "Oeffnungszeiten": "Öffnungszeiten",
      "Offnen": "Öffnen",
      "Personliches": "Persönliches",
      "Praferenzen": "Präferenzen",
      "Pruefe": "Prüfe",
      "Pruefen": "Prüfen",
      "Pruefung": "Prüfung",
      "Prufe": "Prüfe",
      "Prufen": "Prüfen",
      "Prufung": "Prüfung",
      "Prufungen": "Prüfungen",
      "Roentgenbild": "Röntgenbild",
      "Roentgenbilder": "Röntgenbilder",
      "Rueckruf": "Rückruf",
      "Rueckwaerts": "Rückwärts",
      "Ruheuebung": "Ruheübung",
      "Schliessen": "Schließen",
      "Schluessel": "Schlüssel",
      "Spaeter": "Später",
      "Spater": "Später",
      "Sprachfuhrung": "Sprachführung",
      "Staerke": "Stärke",
      "Taegliche": "Tägliche",
      "Tagesaktivitaten": "Tagesaktivitäten",
      "Tagliche": "Tägliche",
      "Taglicher": "Täglicher",
      "Tagliches": "Tägliches",
      "Telefonschatzung": "Telefonschätzung",
      "Telefonschatzungen": "Telefonschätzungen",
      "Trubung": "Trübung",
      "Uben": "Üben",
      "Uber": "Über",
      "Uberspringen": "Überspringen",
      "Uberwachung": "Überwachung",
      "Ubung": "Übung",
      "Ubungen": "Übungen",
      "Ubungsbewertung": "Übungsbewertung",
      "Ubungsdeck": "Übungsdeck",
      "Ubungsfolge": "Übungsfolge",
      "Ubungskarte": "Übungskarte",
      "Ubungsrunde": "Übungsrunde",
      "Ueben": "Üben",
      "Uebereinstimmung": "Übereinstimmung",
      "Ueberspringen": "Überspringen",
      "Uebung": "Übung",
      "Uebungsbeispiel": "Übungsbeispiel",
      "Uebungsrunde": "Übungsrunde",
      "Unterstuetzung": "Unterstützung",
      "Unterstutzung": "Unterstützung",
      "Verdachtige": "Verdächtige",
      "Verfuegbarkeit": "Verfügbarkeit",
      "Vertrauenswuerdigen": "Vertrauenswürdigen",
      "Vollstandigen": "Vollständigen",
      "Vollstandiger": "Vollständiger",
      "Vorschlaege": "Vorschläge",
      "Waehle": "Wähle",
      "Waehlen": "Wählen",
      "Wahle": "Wähle",
      "Worter": "Wörter",
      "Wortern": "Wörtern",
      "Zaehlen": "Zählen",
      "Zahlengedachtnis": "Zahlengedächtnis",
      "Zuhoeren": "Zuhören",
      "Zuruck": "Zurück",
      "Zuruecksetzen": "Zurücksetzen",
      "abschliessen": "abschließen",
      "aendern": "ändern",
      "aendert": "ändert",
      "aerztliche": "ärztliche",
      "andert": "ändert",
      "anfuehlt": "anfühlt",
      "anfuhlt": "anfühlt",
      "anhoeren": "anhören",
      "anhoren": "anhören",
      "aufgehort": "aufgehört",
      "ausfuellen": "ausfüllen",
      "ausgefullt": "ausgefüllt",
      "ausserhalb": "außerhalb",
      "auswahlen": "auswählen",
      "auszufullen": "auszufüllen",
      "benoetigt": "benötigt",
      "berucksichtigt": "berücksichtigt",
      "beschaftigt": "beschäftigt",
      "bestaetigen": "bestätigen",
      "bestaetigt": "bestätigt",
      "bestatigen": "bestätigen",
      "bestatigt": "bestätigt",
      "druecke": "drücke",
      "durfen": "dürfen",
      "erganzen": "ergänzen",
      "erhalt": "erhält",
      "erhohen": "erhöhen",
      "erhoht": "erhöht",
      "erklaert": "erklärt",
      "erklart": "erklärt",
      "faellig": "fällig",
      "fallig": "fällig",
      "fruhere": "frühere",
      "fuegt": "fügt",
      "fuehlst": "fühlst",
      "fuer": "für",
      "fuhle": "fühle",
      "fuhlt": "fühlt",
      "fullen": "füllen",
      "geaendert": "geändert",
      "geaenderte": "geänderte",
      "geandert": "geändert",
      "gedrueckt": "gedrückt",
      "gefuhrte": "geführte",
      "gehoert": "gehört",
      "gehort": "gehört",
      "gehorten": "gehörten",
      "geoeffnet": "geöffnet",
      "geoffnet": "geöffnet",
      "geoffnete": "geöffnete",
      "geprueft": "geprüft",
      "geprueften": "geprüften",
      "gepruft": "geprüft",
      "geschutzt": "geschützt",
      "geubt": "geübt",
      "gultigen": "gültigen",
      "haeufiger": "häufiger",
      "haeufigeren": "häufigeren",
      "heisst": "heißt",
      "hinzufuegen": "hinzufügen",
      "hinzufugen": "hinzufügen",
      "hinzugefugt": "hinzugefügt",
      "hochste": "höchste",
      "hoeren": "hören",
      "hore": "höre",
      "klaeren": "klären",
      "koennen": "können",
      "koennte": "könnte",
      "koennten": "könnten",
      "konnen": "können",
      "minutige": "minütige",
      "moechtest": "möchtest",
      "moegliche": "mögliche",
      "moeglicherweise": "möglicherweise",
      "moglich": "möglich",
      "moglicherweise": "möglicherweise",
      "mude": "müde",
      "nachste": "nächste",
      "nachsten": "nächsten",
      "nachster": "nächster",
      "naechste": "nächste",
      "naechsten": "nächsten",
      "naechster": "nächster",
      "naturlichen": "natürlichen",
      "noetig": "nötig",
      "oeffentlichen": "öffentlichen",
      "oeffnen": "öffnen",
      "offnen": "öffnen",
      "persoenliche": "persönliche",
      "ploetzlichen": "plötzlichen",
      "pruefen": "prüfen",
      "prueft": "prüft",
      "prufen": "prüfen",
      "pruft": "prüft",
      "schliessen": "schließen",
      "spaeter": "später",
      "spaetere": "spätere",
      "spater": "später",
      "spuren": "spüren",
      "staerke": "stärke",
      "starkere": "stärkere",
      "tagliche": "tägliche",
      "taglichen": "täglichen",
      "uben": "üben",
      "uber": "über",
      "ueben": "üben",
      "ueberein": "überein",
      "ueberspringen": "überspringen",
      "unterstutzende": "unterstützende",
      "unterstutzt": "unterstützt",
      "ursprungliche": "ursprüngliche",
      "verfuegbar": "verfügbar",
      "verfugbar": "verfügbar",
      "verkaufliches": "verkäufliches",
      "verstandlich": "verständlich",
      "verstandlicher": "verständlicher",
      "vertrauenswurdige": "vertrauenswürdige",
      "vervollstandigen": "vervollständigen",
      "vollstandig": "vollständig",
      "waechst": "wächst",
      "waehle": "wähle",
      "waehlen": "wählen",
      "waehrend": "während",
      "wahlen": "wählen",
      "zaehlen": "zählen",
      "zaehlt": "zählt",
      "zugehoert": "zugehört",
      "zuhoeren": "zuhören",
      "zuruckkehren": "zurückkehren",
      "zuruckrufen": "zurückrufen",
      "zurueck": "zurück"
    },
    "es": {
      "Accion": "Acción",
      "Acercate": "Acércate",
      "Acomodate": "Acomódate",
      "Anadir": "Añadir",
      "Aqui": "Aquí",
      "Articulos": "Artículos",
      "Atencion": "Atención",
      "Atras": "Atrás",
      "Ayudame": "Ayúdame",
      "Boton": "Botón",
      "Calido": "Cálido",
      "Camara": "Cámara",
      "Comprension": "Comprensión",
      "Comprobacion": "Comprobación",
      "Cuentame": "Cuéntame",
      "Descripcion": "Descripción",
      "Despues": "Después",
      "Duracion": "Duración",
      "Evaluacion": "Evaluación",
      "Fantastico": "Fantástico",
      "Fotografia": "Fotografía",
      "Guia": "Guía",
      "Informacion": "Información",
      "Intentalo": "Inténtalo",
      "Investigacion": "Investigación",
      "Jardin": "Jardín",
      "Jardineria": "Jardinería",
      "Logica": "Lógica",
      "Manten": "Mantén",
      "Matematicas": "Matemáticas",
      "Medicacion": "Medicación",
      "Metrica": "Métrica",
      "Metricas": "Métricas",
      "Monitorizacion": "Monitorización",
      "Musica": "Música",
      "Ningun": "Ningún",
      "Oir": "Oír",
      "Orientacion": "Orientación",
      "Peluqueria": "Peluquería",
      "Pequeno": "Pequeño",
      "Pideme": "Pídeme",
      "Podras": "Podrás",
      "Podrias": "Podrías",
      "Preparate": "Prepárate",
      "Presion": "Presión",
      "Prevencion": "Prevención",
      "Puntuacion": "Puntuación",
      "Radiografia": "Radiografía",
      "Radiografias": "Radiografías",
      "Reflexion": "Reflexión",
      "Regulacion": "Regulación",
      "Respiracion": "Respiración",
      "Resumenes": "Resúmenes",
      "Seleccion": "Selección",
      "Senales": "Señales",
      "Sientate": "Siéntate",
      "Simbolo": "Símbolo",
      "Sintoma": "Síntoma",
      "Sintomas": "Síntomas",
      "Tambien": "También",
      "Tensiometro": "Tensiómetro",
      "Tocalo": "Tócalo",
      "Ultimos": "Últimos",
      "Util": "Útil",
      "abrio": "abrió",
      "accion": "acción",
      "acompanante": "acompañante",
      "acompane": "acompañe",
      "actualizacion": "actualización",
      "agil": "ágil",
      "ahi": "ahí",
      "anadida": "añadida",
      "anadido": "añadido",
      "aplicacion": "aplicación",
      "aqui": "aquí",
      "articulos": "artículos",
      "asi": "así",
      "atencion": "atención",
      "atras": "atrás",
      "automatica": "automática",
      "ayudaria": "ayudaría",
      "balcon": "balcón",
      "basandote": "basándote",
      "boton": "botón",
      "camara": "cámara",
      "cardiaca": "cardíaca",
      "cardiologo": "cardiólogo",
      "cientifica": "científica",
      "clinica": "clínica",
      "clinico": "clínico",
      "combinacion": "combinación",
      "comoda": "cómoda",
      "comprension": "comprensión",
      "comprobacion": "comprobación",
      "concentracion": "concentración",
      "configuracion": "configuración",
      "confirmacion": "confirmación",
      "conversacion": "conversación",
      "corazon": "corazón",
      "cuentalo": "cuéntalo",
      "cuentalos": "cuéntalos",
      "demas": "demás",
      "despues": "después",
      "dia": "día",
      "dias": "días",
      "dibujalo": "dibújalo",
      "dificil": "difícil",
      "dificiles": "difíciles",
      "economica": "económica",
      "eleccion": "elección",
      "empezo": "empezó",
      "energia": "energía",
      "envia": "envía",
      "envian": "envían",
      "episodica": "episódica",
      "estacion": "estación",
      "estan": "están",
      "estara": "estará",
      "estes": "estés",
      "estimacion": "estimación",
      "evaluacion": "evaluación",
      "explicacion": "explicación",
      "exportacion": "exportación",
      "facil": "fácil",
      "farmaceutica": "farmacéutica",
      "farmaceutico": "farmacéutico",
      "guia": "guía",
      "habitacion": "habitación",
      "hidratacion": "hidratación",
      "imaginacion": "imaginación",
      "infeccion": "infección",
      "informacion": "información",
      "intentalo": "inténtalo",
      "interaccion": "interacción",
      "jardin": "jardín",
      "leccion": "lección",
      "matematica": "matemática",
      "matematicas": "matemáticas",
      "mayoria": "mayoría",
      "medicacion": "medicación",
      "medicion": "medición",
      "microfono": "micrófono",
      "monitorizacion": "monitorización",
      "moraton": "moratón",
      "ningun": "ningún",
      "numerica": "numérica",
      "numeros": "números",
      "oido": "oído",
      "oirlo": "oírlo",
      "opcion": "opción",
      "orientacion": "orientación",
      "pais": "país",
      "pajaro": "pájaro",
      "peluqueria": "peluquería",
      "pequena": "pequeña",
      "pequeno": "pequeño",
      "pequenos": "pequeños",
      "planificacion": "planificación",
      "podria": "podría",
      "preocupacion": "preocupación",
      "presentacion": "presentación",
      "presion": "presión",
      "prevencion": "prevención",
      "progresion": "progresión",
      "propon": "propón",
      "proxima": "próxima",
      "proximos": "próximos",
      "puntuacion": "puntuación",
      "radiografias": "radiografías",
      "rapida": "rápida",
      "rapidas": "rápidas",
      "rapido": "rápido",
      "reaccion": "reacción",
      "recien": "recién",
      "recomendacion": "recomendación",
      "reflexion": "reflexión",
      "reposicion": "reposición",
      "reproduccion": "reproducción",
      "reputacion": "reputación",
      "respiracion": "respiración",
      "reune": "reúne",
      "segun": "según",
      "seleccion": "selección",
      "senal": "señal",
      "senalar": "señalar",
      "senales": "señales",
      "sesion": "sesión",
      "simbolo": "símbolo",
      "simbolos": "símbolos",
      "sintomas": "síntomas",
      "sono": "sonó",
      "tactil": "táctil",
      "tambien": "también",
      "telefonica": "telefónica",
      "telefono": "teléfono",
      "terminos": "términos",
      "termometro": "termómetro",
      "todavia": "todavía",
      "unico": "único",
      "util": "útil"
    },
    "fr": {
      "Acces": "Accès",
      "Actualites": "Actualités",
      "Arret": "Arrêt",
      "Arreter": "Arrêter",
      "Communaute": "Communauté",
      "Confidentialite": "Confidentialité",
      "Connaitre": "Connaître",
      "Controle": "Contrôle",
      "Controles": "Contrôles",
      "Deconnecte": "Déconnecte",
      "Decrivez": "Décrivez",
      "Demarrage": "Démarrage",
      "Demarrer": "Démarrer",
      "Derniere": "Dernière",
      "Dernieres": "Dernières",
      "Desactiver": "Désactiver",
      "Disponibilite": "Disponibilité",
      "Duree": "Durée",
      "Echanger": "Échanger",
      "Echecs": "Échecs",
      "Economiser": "Économiser",
      "Ecoute": "Écoute",
      "Ecouter": "Écouter",
      "Ecoutez": "Écoutez",
      "Ecran": "Écran",
      "Ecrire": "Écrire",
      "Ecrivez": "Écrivez",
      "Entrainement": "Entraînement",
      "Etape": "Étape",
      "Etapes": "Étapes",
      "Etat": "État",
      "Etoile": "Étoile",
      "Etoiles": "Étoiles",
      "Evitez": "Évitez",
      "Fievre": "Fièvre",
      "Flexibilite": "Flexibilité",
      "Frequence": "Fréquence",
      "Itineraires": "Itinéraires",
      "Maree": "Marée",
      "Medecin": "Médecin",
      "Medicaments": "Médicaments",
      "Memoire": "Mémoire",
      "Memorisez": "Mémorisez",
      "Modere": "Modère",
      "Nouveautes": "Nouveautés",
      "Numero": "Numéro",
      "Prenom": "Prénom",
      "Preparez": "Préparez",
      "Prevenir": "Prévenir",
      "Prevoir": "Prévoir",
      "Rediger": "Rédiger",
      "Reessaie": "Réessaie",
      "Reessayer": "Réessayer",
      "Reessayez": "Réessayez",
      "Reflexion": "Réflexion",
      "Reglages": "Réglages",
      "Regler": "Régler",
      "Regles": "Règles",
      "Reinitialiser": "Réinitialiser",
      "Repondre": "Répondre",
      "Reponse": "Réponse",
      "Reserver": "Réserver",
      "Resultat": "Résultat",
      "Resumer": "Résumer",
      "Reussites": "Réussites",
      "Sante": "Santé",
      "Serie": "Série",
      "Symptome": "Symptôme",
      "Symptomes": "Symptômes",
      "Tensiometre": "Tensiomètre",
      "Verifie": "Vérifie",
      "Verifiez": "Vérifiez",
      "acces": "accès",
      "accompagnee": "accompagnée",
      "activite": "activité",
      "activites": "activités",
      "actualite": "actualité",
      "actualites": "actualités",
      "adaptee": "adaptée",
      "adequation": "adéquation",
      "affichee": "affichée",
      "ajoutee": "ajoutée",
      "ameliore": "améliore",
      "analysee": "analysée",
      "apparait": "apparaît",
      "appuye": "appuyé",
      "arrete": "arrête",
      "arreter": "arrêter",
      "arretez": "arrêtez",
      "arrivee": "arrivée",
      "arterielle": "artérielle",
      "assistee": "assistée",
      "bientot": "bientôt",
      "cachees": "cachées",
      "capacite": "capacité",
      "cle": "clé",
      "cles": "clés",
      "commencons": "commençons",
      "communaute": "communauté",
      "compatibilite": "compatibilité",
      "confidentialite": "confidentialité",
      "confirmee": "confirmée",
      "connectee": "connectée",
      "consecutives": "consécutives",
      "conservee": "conservée",
      "consultees": "consultées",
      "controle": "contrôle",
      "controles": "contrôles",
      "cree": "crée",
      "datees": "datées",
      "debloquent": "débloquent",
      "debloquer": "débloquer",
      "decrire": "décrire",
      "defaut": "défaut",
      "defini": "défini",
      "depasse": "dépasse",
      "derniere": "dernière",
      "dernieres": "dernières",
      "detecte": "détecte",
      "detendre": "détendre",
      "diabete": "diabète",
      "dictee": "dictée",
      "differents": "différents",
      "donnees": "données",
      "echanges": "échanges",
      "economiser": "économiser",
      "ecoule": "écoule",
      "ecoute": "écoute",
      "ecran": "écran",
      "ecrite": "écrite",
      "ecrivez": "écrivez",
      "electrolytiques": "électrolytiques",
      "enregistree": "enregistrée",
      "enregistrees": "enregistrées",
      "entrainement": "entraînement",
      "entrainer": "entraîner",
      "entrainez": "entraînez",
      "entrainons": "entraînons",
      "envoye": "envoyé",
      "envoyee": "envoyée",
      "envoyees": "envoyées",
      "epaules": "épaules",
      "episodique": "épisodique",
      "equilibre": "équilibre",
      "equipe": "équipe",
      "etaient": "étaient",
      "etait": "était",
      "etape": "étape",
      "etapes": "étapes",
      "etat": "état",
      "etes": "êtes",
      "etiez": "étiez",
      "etincelle": "étincelle",
      "etre": "être",
      "eviter": "éviter",
      "evitera": "évitera",
      "expediteur": "expéditeur",
      "facon": "façon",
      "facons": "façons",
      "familiere": "familière",
      "fievre": "fièvre",
      "financiere": "financière",
      "flexibilite": "flexibilité",
      "gere": "gère",
      "glycemie": "glycémie",
      "guidee": "guidée",
      "idees": "idées",
      "identite": "identité",
      "importee": "importée",
      "inquietant": "inquiétant",
      "inquiete": "inquiète",
      "journee": "journée",
      "lecon": "leçon",
      "leger": "léger",
      "liee": "liée",
      "lumiere": "lumière",
      "manquees": "manquées",
      "medecin": "médecin",
      "medicale": "médicale",
      "medicamenteuse": "médicamenteuse",
      "medicaments": "médicaments",
      "memoire": "mémoire",
      "memoriser": "mémoriser",
      "memorisez": "mémorisez",
      "merite": "mérite",
      "meriter": "mériter",
      "mobilite": "mobilité",
      "modere": "modère",
      "necessaire": "nécessaire",
      "necessaires": "nécessaires",
      "necessiter": "nécessiter",
      "numerique": "numérique",
      "numeriques": "numériques",
      "numero": "numéro",
      "oxygene": "oxygène",
      "oxymetre": "oxymètre",
      "personnalisee": "personnalisée",
      "plutot": "plutôt",
      "prenom": "prénom",
      "preparera": "préparera",
      "preparez": "préparez",
      "preparons": "préparons",
      "presente": "présente",
      "prete": "prête",
      "pretes": "prêtes",
      "prets": "prêts",
      "prevu": "prévu",
      "prevue": "prévue",
      "prevues": "prévues",
      "probleme": "problème",
      "progres": "progrès",
      "quantite": "quantité",
      "reagissant": "réagissant",
      "reagissez": "réagissez",
      "recente": "récente",
      "recentes": "récentes",
      "recents": "récents",
      "recommandee": "recommandée",
      "recommandees": "recommandées",
      "reduire": "réduire",
      "reessaie": "réessaie",
      "reessaye": "réessaye",
      "reessayer": "réessayer",
      "reessayez": "réessayez",
      "reessayons": "réessayons",
      "regle": "règle",
      "regles": "règles",
      "rehydratation": "réhydratation",
      "relacher": "relâcher",
      "remarquee": "remarquée",
      "repond": "répond",
      "repondez": "répondez",
      "repondre": "répondre",
      "reponse": "réponse",
      "reponses": "réponses",
      "reserver": "réserver",
      "reservez": "réservez",
      "resultat": "résultat",
      "resultats": "résultats",
      "sante": "santé",
      "serie": "série",
      "specialiste": "spécialiste",
      "specialistes": "spécialistes",
      "suggere": "suggère",
      "supprimee": "supprimée",
      "surement": "sûrement",
      "symptomes": "symptômes",
      "terminee": "terminée",
      "thermometre": "thermomètre",
      "utilisees": "utilisées",
      "verifie": "vérifie"
    },
    "pt": {
      "Acao": "Ação",
      "Acoes": "Ações",
      "Adesao": "Adesão",
      "Agucar": "Aguçar",
      "Alguem": "Alguém",
      "Atencao": "Atenção",
      "Atualizacoes": "Atualizações",
      "Avaliacao": "Avaliação",
      "Botao": "Botão",
      "Camara": "Câmara",
      "Carrilhao": "Carrilhão",
      "Comecar": "Começar",
      "Compreensao": "Compreensão",
      "Concluido": "Concluído",
      "Condicoes": "Condições",
      "Confianca": "Confiança",
      "Definicoes": "Definições",
      "Descricao": "Descrição",
      "Duracao": "Duração",
      "Ecra": "Ecrã",
      "Emergencia": "Emergência",
      "Estavel": "Estável",
      "Estetoscopio": "Estetoscópio",
      "Exercicio": "Exercício",
      "Exercicios": "Exercícios",
      "Faco": "Faço",
      "Fantastico": "Fantástico",
      "Formularios": "Formulários",
      "Frequencia": "Frequência",
      "Historico": "Histórico",
      "Horario": "Horário",
      "Informacao": "Informação",
      "Instrucoes": "Instruções",
      "Interacoes": "Interações",
      "Ligacao": "Ligação",
      "Localizacao": "Localização",
      "Logica": "Lógica",
      "Matematica": "Matemática",
      "Medicacao": "Medicação",
      "Medio": "Médio",
      "Metrica": "Métrica",
      "Metricas": "Métricas",
      "Monitorizacao": "Monitorização",
      "Nao": "Não",
      "Necessario": "Necessário",
      "Nivel": "Nível",
      "Nodoas": "Nódoas",
      "Numeros": "Números",
      "Obrigatorio": "Obrigatório",
      "Opcoes": "Opções",
      "Orientacao": "Orientação",
      "Otimo": "Ótimo",
      "Ouca": "Ouça",
      "Pontuacao": "Pontuação",
      "Pre": "Pré",
      "Precisao": "Precisão",
      "Preco": "Preço",
      "Predefinicoes": "Predefinições",
      "Preferencias": "Preferências",
      "Pressao": "Pressão",
      "Prevencao": "Prevenção",
      "Proxima": "Próxima",
      "Proximos": "Próximos",
      "Recomecar": "Recomeçar",
      "Recordacao": "Recordação",
      "Reflexao": "Reflexão",
      "Regulacao": "Regulação",
      "Relatorio": "Relatório",
      "Relatorios": "Relatórios",
      "Reparacoes": "Reparações",
      "Reposicoes": "Reposições",
      "Respiracao": "Respiração",
      "Reuniao": "Reunião",
      "Revisao": "Revisão",
      "Saude": "Saúde",
      "Seguranca": "Segurança",
      "Selecao": "Seleção",
      "Seras": "Serás",
      "Servicos": "Serviços",
      "Simbolo": "Símbolo",
      "Subscricao": "Subscrição",
      "Sugestoes": "Sugestões",
      "Tambem": "Também",
      "Tendencias": "Tendências",
      "Tensao": "Tensão",
      "Trico": "Tricô",
      "Ultimos": "Últimos",
      "Util": "Útil",
      "Verificacao": "Verificação",
      "Verificacoes": "Verificações",
      "Voce": "Você",
      "acao": "ação",
      "adesao": "adesão",
      "alcancou": "alcançou",
      "alguem": "alguém",
      "alteracao": "alteração",
      "alteracoes": "alterações",
      "amigavel": "amigável",
      "aplicacao": "aplicação",
      "apresentacao": "apresentação",
      "aprovacao": "aprovação",
      "atencao": "atenção",
      "atualizacao": "atualização",
      "atualizacoes": "atualizações",
      "automatica": "automática",
      "avaliacao": "avaliação",
      "botao": "botão",
      "botoes": "botões",
      "cabeca": "cabeça",
      "camara": "câmara",
      "cardiaca": "cardíaca",
      "cartao": "cartão",
      "cartoes": "cartões",
      "clinica": "clínica",
      "combinacao": "combinação",
      "combinacoes": "combinações",
      "comeca": "começa",
      "comecar": "começar",
      "compreensao": "compreensão",
      "concentracao": "concentração",
      "concluida": "concluída",
      "concluido": "concluído",
      "condicoes": "condições",
      "confianca": "confiança",
      "configuracao": "configuração",
      "confirmacao": "confirmação",
      "confortavel": "confortável",
      "conteudo": "conteúdo",
      "coracao": "coração",
      "correspondencia": "correspondência",
      "diaria": "diária",
      "diarias": "diárias",
      "diario": "diário",
      "diarios": "diários",
      "dificeis": "difíceis",
      "dificil": "difícil",
      "disponiveis": "disponíveis",
      "disponivel": "disponível",
      "divisao": "divisão",
      "doenca": "doença",
      "ecra": "ecrã",
      "eletrolitos": "eletrólitos",
      "emergencia": "emergência",
      "episodica": "episódica",
      "esforco": "esforço",
      "esqueca": "esqueça",
      "estacao": "estação",
      "estao": "estão",
      "estara": "estará",
      "estaveis": "estáveis",
      "estavel": "estável",
      "estomago": "estômago",
      "exercicio": "exercício",
      "exercicios": "exercícios",
      "explicacao": "explicação",
      "faceis": "fáceis",
      "facil": "fácil",
      "farmaceutico": "farmacêutico",
      "farmacia": "farmácia",
      "flexivel": "flexível",
      "formulacao": "formulação",
      "formulario": "formulário",
      "frequencia": "frequência",
      "hidratacao": "hidratação",
      "historico": "histórico",
      "horario": "horário",
      "horarios": "horários",
      "impar": "ímpar",
      "implementacao": "implementação",
      "indisponivel": "indisponível",
      "informacao": "informação",
      "informacoes": "informações",
      "instrucoes": "instruções",
      "interacao": "interação",
      "interacoes": "interações",
      "juridico": "jurídico",
      "lesao": "lesão",
      "licao": "lição",
      "ligacao": "ligação",
      "matematica": "matemática",
      "medicacao": "medicação",
      "medicacoes": "medicações",
      "medicao": "medição",
      "monitorizacao": "monitorização",
      "mudanca": "mudança",
      "nao": "não",
      "necessaria": "necessária",
      "necessario": "necessário",
      "ninguem": "ninguém",
      "nivel": "nível",
      "nodoa": "nódoa",
      "nodoas": "nódoas",
      "numerica": "numérica",
      "numericos": "numéricos",
      "numeros": "números",
      "obrigatorio": "obrigatório",
      "obrigatorios": "obrigatórios",
      "opcao": "opção",
      "opcoes": "opções",
      "orcamento": "orçamento",
      "orientacao": "orientação",
      "ouca": "ouça",
      "oxigenio": "oxigénio",
      "padroes": "padrões",
      "passaro": "pássaro",
      "periodo": "período",
      "pontuacao": "pontuação",
      "posicao": "posição",
      "possiveis": "possíveis",
      "possivel": "possível",
      "poupancas": "poupanças",
      "pre": "pré",
      "preco": "preço",
      "preferencias": "preferências",
      "preocupacao": "preocupação",
      "pressao": "pressão",
      "prevencao": "prevenção",
      "principios": "princípios",
      "progressao": "progressão",
      "proxima": "próxima",
      "proximas": "próximas",
      "proximos": "próximos",
      "publicos": "públicos",
      "raciocinio": "raciocínio",
      "rapida": "rápida",
      "rapidas": "rápidas",
      "rapido": "rápido",
      "reacao": "reação",
      "recomendacao": "recomendação",
      "recordacao": "recordação",
      "relatorio": "relatório",
      "relatorios": "relatórios",
      "reparacoes": "reparações",
      "repeticoes": "repetições",
      "reposicao": "reposição",
      "reposicoes": "reposições",
      "reproducao": "reprodução",
      "reputacao": "reputação",
      "residencia": "residência",
      "respiracao": "respiração",
      "respiracoes": "respirações",
      "respiratoria": "respiratória",
      "revisao": "revisão",
      "saida": "saída",
      "salao": "salão",
      "sao": "são",
      "saude": "saúde",
      "seccao": "secção",
      "secundarios": "secundários",
      "seguranca": "segurança",
      "selecao": "seleção",
      "sera": "será",
      "servico": "serviço",
      "servicos": "serviços",
      "sessao": "sessão",
      "simbolo": "símbolo",
      "simbolos": "símbolos",
      "situacao": "situação",
      "sugestao": "sugestão",
      "tambem": "também",
      "telefonica": "telefónica",
      "tendencia": "tendência",
      "tendencias": "tendências",
      "tensao": "tensão",
      "tercas": "terças",
      "termometro": "termómetro",
      "tras": "trás",
      "triangulo": "triângulo",
      "turvacao": "turvação",
      "unico": "único",
      "urgencia": "urgência",
      "util": "útil",
      "utilizavel": "utilizável",
      "vao": "vão",
      "verificacao": "verificação",
      "verificacoes": "verificações",
      "visiveis": "visíveis",
      "visivel": "visível",
      "visualizacao": "visualização",
      "voce": "você"
    }
  },
  "review": {
    "de": {
      "Fur": [
        "Für"
      ],
      "Gross": [
        "Groß"
      ],
      "Roentgen": [
        "Röntgen"
      ],
      "dose": [
        "döse"
      ],
      "fur": [
        "für"
      ]
    },
    "es": {
      "Anade": [
        "Añade",
        "Ánade"
      ],
      "Area": [
        "Área"
      ],
      "Maria": [
        "María"
      ],
      "Precision": [
        "Precisión"
      ],
      "Proximo": [
        "Próximo"
      ],
      "Revision": [
        "Revisión"
      ],
      "anade": [
        "añade",
        "ánade"
      ],
      "area": [
        "área"
      ],
      "areas": [
        "áreas"
      ],
      "continue": [
        "continué",
        "continúe"
      ],
      "hare": [
        "haré"
      ],
      "latex": [
        "látex"
      ],
      "lesion": [
        "lesión"
      ],
      "medium": [
        "médium"
      ],
      "min": [
        "mín"
      ],
      "name": [
        "ñame"
      ],
      "names": [
        "ñames"
      ],
      "precision": [
        "precisión"
      ],
      "records": [
        "récords"
      ],
      "revision": [
        "revisión"
      ],
      "salon": [
        "salón"
      ],
      "tension": [
        "tensión"
      ],
      "value": [
        "valué",
        "valúe"
      ],
      "values": [
        "valúes"
      ]
    },
    "fr": {
      "Adherence": [
        "Adhérence"
      ],
      "Apercu": [
        "Aperçu"
      ],
      "Apres": [
        "Après",
        "Âpres"
      ],
      "Completer": [
        "Compléter"
      ],
      "Comprehension": [
        "Compréhension"
      ],
      "Debut": [
        "Début"
      ],
      "Details": [
        "Détails"
      ],
      "Email": [
        "Émail"
      ],
      "Etiquette": [
        "Étiquette"
      ],
      "Evaluation": [
        "Évaluation"
      ],
      "Ideal": [
        "Idéal"
      ],
      "Leger": [
        "Léger"
      ],
      "Leve": [
        "Levé",
        "Lève"
      ],
      "Medicament": [
        "Médicament"
      ],
      "Medication": [
        "Médication"
      ],
      "Medications": [
        "Médications"
      ],
      "Melange": [
        "Mélange"
      ],
      "Meme": [
        "Mème",
        "Même"
      ],
      "Precision": [
        "Précision"
      ],
      "Premiere": [
        "Première"
      ],
      "Preparation": [
        "Préparation"
      ],
      "Prepare": [
        "Prépare"
      ],
      "Preparer": [
        "Préparer"
      ],
      "Pret": [
        "Prêt"
      ],
      "Prevention": [
        "Prévention"
      ],
      "Protege": [
        "Protège"
      ],
      "Regulation": [
        "Régulation"
      ],
      "Reparations": [
        "Réparations"
      ],
      "Reservations": [
        "Réservations"
      ],
      "Resume": [
        "Résume"
      ],
      "Resumes": [
        "Résumes"
      ],
      "Reunion": [
        "Réunion"
      ],
      "Selection": [
        "Sélection"
      ],
      "Sequences": [
        "Séquences"
      ],
      "Stethoscope": [
        "Stéthoscope"
      ],
      "The": [
        "Thé"
      ],
      "Tres": [
        "Très"
      ],
      "Verification": [
        "Vérification"
      ],
      "Verifications": [
        "Vérifications"
      ],
      "Verifier": [
        "Vérifier"
      ],
      "adherence": [
        "adhérence"
      ],
      "apercu": [
        "aperçu"
      ],
      "apres": [
        "après",
        "âpres"
      ],
      "categories": [
        "catégories"
      ],
      "codeine": [
        "codéine"
      ],
      "complements": [
        "compléments"
      ],
      "complete": [
        "complète"
      ],
      "completer": [
        "compléter"
      ],
      "comprehension": [
        "compréhension"
      ],
      "creative": [
        "créative"
      ],
      "decider": [
        "décider"
      ],
      "decline": [
        "décline"
      ],
      "demarche": [
        "démarche"
      ],
      "depart": [
        "départ"
      ],
      "detail": [
        "détail"
      ],
      "details": [
        "détails"
      ],
      "different": [
        "diffèrent",
        "différent"
      ],
      "donnee": [
        "donnée"
      ],
      "economies": [
        "économies"
      ],
      "email": [
        "émail"
      ],
      "emmene": [
        "emmené",
        "emmène"
      ],
      "etiquette": [
        "étiquette"
      ],
      "evaluation": [
        "évaluation"
      ],
      "evidence": [
        "évidence"
      ],
      "frequent": [
        "fréquent"
      ],
      "gate": [
        "gâte"
      ],
      "gene": [
        "gène",
        "gêne"
      ],
      "here": [
        "hère"
      ],
      "hero": [
        "héro"
      ],
      "implementation": [
        "implémentation"
      ],
      "ingredients": [
        "ingrédients"
      ],
      "inquietude": [
        "inquiétude"
      ],
      "legal": [
        "légal"
      ],
      "lesion": [
        "lésion"
      ],
      "medical": [
        "médical"
      ],
      "medicament": [
        "médicament"
      ],
      "medication": [
        "médication"
      ],
      "medications": [
        "médications"
      ],
      "meditation": [
        "méditation"
      ],
      "melange": [
        "mélange"
      ],
      "meme": [
        "mème",
        "même"
      ],
      "menage": [
        "ménage"
      ],
      "pensee": [
        "pensée"
      ],
      "piece": [
        "pièce"
      ],
      "plait": [
        "plaît"
      ],
      "premiere": [
        "première"
      ],
      "prepare": [
        "prépare"
      ],
      "preparer": [
        "préparer"
      ],
      "pres": [
        "près",
        "prés"
      ],
      "presentation": [
        "présentation"
      ],
      "presenter": [
        "présenter"
      ],
      "pret": [
        "prêt"
      ],
      "prevention": [
        "prévention"
      ],
      "reaction": [
        "réaction"
      ],
      "recent": [
        "récent"
      ],
      "reduction": [
        "réduction"
      ],
      "reflexes": [
        "réflexes"
      ],
      "reparations": [
        "réparations"
      ],
      "reputation": [
        "réputation"
      ],
      "reservation": [
        "réservation"
      ],
      "reserve": [
        "réserve"
      ],
      "residence": [
        "résidence"
      ],
      "resume": [
        "résume"
      ],
      "roles": [
        "rôles"
      ],
      "selection": [
        "sélection"
      ],
      "sequence": [
        "séquence"
      ],
      "special": [
        "spécial"
      ],
      "temperature": [
        "température"
      ],
      "tete": [
        "tète",
        "tête"
      ],
      "the": [
        "thé"
      ],
      "tot": [
        "tôt"
      ],
      "tres": [
        "très"
      ],
      "verification": [
        "vérification"
      ],
      "verifier": [
        "vérifier"
      ],
      "verifies": [
        "vérifies"
      ],
      "zero": [
        "zéro"
      ]
    },
    "pt": {
      "Area": [
        "Área"
      ],
      "Carmen": [
        "Cármen"
      ],
      "Comecamos": [
        "Começamos",
        "Começámos"
      ],
      "Mare": [
        "Maré"
      ],
      "Proximo": [
        "Próximo"
      ],
      "Taxi": [
        "Táxi"
      ],
      "Tres": [
        "Três"
      ],
      "apos": [
        "após",
        "apôs"
      ],
      "area": [
        "área"
      ],
      "areas": [
        "áreas"
      ],
      "aria": [
        "ária"
      ],
      "audio": [
        "áudio"
      ],
      "comecamos": [
        "começamos",
        "começámos"
      ],
      "has": [
        "hás"
      ],
      "latex": [
        "látex"
      ],
      "mantem": [
        "mantém",
        "mantêm"
      ],
      "medicos": [
        "médicos"
      ],
      "medium": [
        "médium"
      ],
      "proximo": [
        "próximo"
      ],
      "senior": [
        "sénior"
      ],
      "taxi": [
        "táxi"
      ]
    }
  }
};
export const AUTO_REPLACEMENTS = DIACRITICS_MAP.auto;
export const REVIEW_REPLACEMENTS = DIACRITICS_MAP.review;

export const TRANSLATION_FILES = {
  de: ["src/i18n/de.ts", "src/i18n/locales/de.json"],
  es: ["src/i18n/es.ts", "src/i18n/locales/es.json"],
  fr: ["src/i18n/fr.ts", "src/i18n/locales/fr.json"],
  pt: ["src/i18n/pt.ts", "src/i18n/locales/pt.json"],
};

const PROTECTED_PATTERN = /(\{\{[^{}]+\}\}|https?:\/\/[^\s]+|www\.[^\s]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|`[^`]*`)/gu;
const ALL_CAPS_PATTERN = /^\p{Lu}[\p{Lu}\p{N}_-]*$/u;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function replaceStringValue(value, replacements) {
  let count = 0;
  const protectedSpans = [];
  const protectedValue = value.replace(PROTECTED_PATTERN, (match) => {
    const marker = `\uE000${protectedSpans.length}\uE001`;
    protectedSpans.push(match);
    return marker;
  });

  let result = protectedValue;
  for (const [word, replacement] of Object.entries(replacements)) {
    const boundary = new RegExp(`(?<![\\p{L}])${escapeRegExp(word)}(?![\\p{L}])`, "gu");
    result = result.replace(boundary, (match) => {
      if (ALL_CAPS_PATTERN.test(match)) return match;
      count += 1;
      return replacement;
    });
  }

  result = result.replace(/\uE000(\d+)\uE001/g, (_marker, index) => protectedSpans[Number(index)]);
  return { value: result, count };
}

function isPropertyValue(node) {
  return ts.isPropertyAssignment(node.parent) && node.parent.initializer === node;
}

function restoreTypeScript(sourceText, replacements, fileName) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits = [];
  let count = 0;

  function visit(node) {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isPropertyValue(node)) {
      const start = node.getStart(sourceFile);
      const end = node.getEnd();
      const rawValue = sourceText.slice(start + 1, end - 1);
      const restored = replaceStringValue(rawValue, replacements);
      if (restored.count > 0) {
        edits.push({ start: start + 1, end: end - 1, text: restored.value });
        count += restored.count;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  let output = sourceText;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return { output, count };
}

function restoreJsonValue(value, replacements) {
  if (typeof value === "string") return replaceStringValue(value, replacements);
  if (Array.isArray(value)) {
    let count = 0;
    const restored = value.map((item) => {
      const result = restoreJsonValue(item, replacements);
      count += result.count;
      return result.value;
    });
    return { value: restored, count };
  }
  if (value && typeof value === "object") {
    let count = 0;
    const restored = {};
    for (const [key, item] of Object.entries(value)) {
      const result = restoreJsonValue(item, replacements);
      restored[key] = result.value;
      count += result.count;
    }
    return { value: restored, count };
  }
  return { value, count: 0 };
}

function restoreJson(sourceText, replacements) {
  const restored = restoreJsonValue(JSON.parse(sourceText), replacements);
  return { output: JSON.stringify(restored.value, null, 2) + "\n", count: restored.count };
}

export function restoreFile(filePath, replacements) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const result = filePath.endsWith(".json")
    ? restoreJson(sourceText, replacements)
    : restoreTypeScript(sourceText, replacements, filePath);
  if (result.output !== sourceText) fs.writeFileSync(filePath, result.output, "utf8");
  return result.count;
}

export function run(rootDir = process.cwd()) {
  for (const [language, files] of Object.entries(TRANSLATION_FILES)) {
    for (const relativePath of files) {
      const filePath = path.join(rootDir, relativePath);
      const count = restoreFile(filePath, AUTO_REPLACEMENTS[language]);
      console.log(`${relativePath}: ${count} replacements`);
    }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) run();

