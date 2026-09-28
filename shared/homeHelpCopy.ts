const languages = ["en", "es", "fr", "de", "it", "pt"];
const copy = {
  destination: ["Where should the provider come?", "¿Dónde debe ir el proveedor?", "À quelle adresse le prestataire doit-il venir ?", "Wohin soll der Anbieter kommen?", "Dove deve venire il fornitore?", "A que endereço deve ir o prestador?"],
  where: ["Where do you need help?", "¿Dónde necesitas ayuda?", "Où avez-vous besoin d’aide ?", "Wo benötigen Sie Hilfe?", "Dove serve aiuto?", "Onde precisa de ajuda?"],
  use: ["Use this address", "Usar esta dirección", "Utiliser cette adresse", "Diese Adresse verwenden", "Usa questo indirizzo", "Usar este endereço"],
  search: ["Search near this address", "Buscar cerca de esta dirección", "Rechercher près de cette adresse", "In der Nähe dieser Adresse suchen", "Cerca vicino a questo indirizzo", "Pesquisar perto deste endereço"],
  another: ["Use another address", "Usar otra dirección", "Utiliser une autre adresse", "Andere Adresse verwenden", "Usa un altro indirizzo", "Usar outro endereço"],
  suggested: ["Suggested provider", "Proveedor sugerido", "Prestataire suggéré", "Vorgeschlagener Anbieter", "Fornitore suggerito", "Prestador sugerido"],
  contact: ["Contact this provider", "Contactar con este proveedor", "Contacter ce prestataire", "Diesen Anbieter kontaktieren", "Contatta questo fornitore", "Contactar este prestador"],
  others: ["See other options", "Ver otras opciones", "Voir les autres options", "Weitere Optionen anzeigen", "Vedi altre opzioni", "Ver outras opções"],
  again: ["Search again", "Buscar de nuevo", "Rechercher à nouveau", "Erneut suchen", "Cerca di nuovo", "Pesquisar novamente"],
  map: ["View map", "Ver mapa", "Voir la carte", "Karte anzeigen", "Visualizza mappa", "Ver mapa"],
  website: ["Website", "Sitio web", "Site web", "Website", "Sito web", "Site"],
  hours: ["Opening hours", "Horario", "Horaires d’ouverture", "Öffnungszeiten", "Orari di apertura", "Horário de funcionamento"],
  near: ["Searching near", "Buscando cerca de", "Recherche à proximité de", "Suche in der Nähe von", "Ricerca vicino a", "Pesquisa perto de"],
  addressHint: ["Address, apartment, entrance, or access notes", "Dirección, piso, puerta o notas de acceso", "Adresse, appartement, entrée ou indications d’accès", "Adresse, Wohnung, Eingang oder Zugangshinweise", "Indirizzo, appartamento, ingresso o indicazioni di accesso", "Endereço, apartamento, entrada ou indicações de acesso"],
  addressUse: ["This address is used for this search only. Your profile stays unchanged.", "Esta dirección se usa solo para esta búsqueda. Tu perfil no cambia.", "Cette adresse sert uniquement à cette recherche. Votre profil reste inchangé.", "Diese Adresse wird nur für diese Suche verwendet. Ihr Profil bleibt unverändert.", "Questo indirizzo viene usato solo per questa ricerca. Il profilo resta invariato.", "Este endereço é usado apenas nesta pesquisa. O seu perfil não é alterado."],
} satisfies Record<string, [string, string, string, string, string, string]>;

export function homeHelpCopy(language: string, key: keyof typeof copy): string {
  const index = languages.indexOf(language.toLowerCase().split(/[-_]/)[0]);
  return copy[key][Math.max(0, index)];
}
