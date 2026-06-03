export type ShoppingCategory = "groceries" | "pharmacy_basics" | "household" | "mobility_aids";

export type ShoppingCategoryChoice = ShoppingCategory | "safe_home";

export type ShoppingPriority =
  | "budget"
  | "simplicity"
  | "accessibility"
  | "diet"
  | "delivery"
  | "safety";

export type ShoppingLocale = "en" | "es";

export type LocalizedText = Record<ShoppingLocale, string>;

export type ShoppingSupportPackageId = string;

export interface ShoppingProduct {
  id: string;
  category: ShoppingCategory;
  name: string;
  priceLabel: string;
  description: string;
  benefits: string[];
  tags: string[];
  suitability: string[];
  cautions: string[];
  accessibilityNotes: string[];
  availabilityLabel: string;
  priceTier: "low" | "medium" | "high";
}

export interface ShoppingNeedInput {
  needText?: string;
  category?: ShoppingCategoryChoice | string | null;
  priorities?: ShoppingPriority[];
  constraints?: string[];
  locale?: string;
  packageId?: string | null;
}

export interface ShoppingRecommendation {
  product: ShoppingProduct;
  score: number;
  rankLabel: "Best fit" | "Lowest cost" | "Easiest choice" | "Best first step" | "Best for night trips" | "Best if standing is hard" | "Best for less bending";
  reasons: string[];
  tradeoffs: string[];
  cautionNotes: string[];
  confidence: "high" | "medium" | "low";
}

export interface ShoppingComparison {
  summary: string;
  differences: string[];
  bestFor: string[];
}

export interface ShoppingRecommendationResponse {
  querySummary: string;
  recommendations: ShoppingRecommendation[];
  comparison: ShoppingComparison;
  uncertaintyNote: string;
  nextQuestions: string[];
}

export interface ShoppingSupportPackageDefinition {
  id: ShoppingSupportPackageId;
  label: LocalizedText;
  description: LocalizedText;
  needText: LocalizedText;
  category: ShoppingCategoryChoice;
  priorities: ShoppingPriority[];
  constraints: Record<Locale, string[]>;
  ctaLabel: LocalizedText;
  serviceRequest?: boolean;
  productIds?: string[];
  isEnabled?: boolean;
  priority?: number;
  adminNotes?: string | null;
}

export interface ShoppingCatalogProduct {
  id: string;
  category: ShoppingCategory;
  name: LocalizedText;
  priceLabel: LocalizedText;
  description: LocalizedText;
  benefits: Record<Locale, string[]>;
  tags: string[];
  suitability: Record<Locale, string[]>;
  cautions: Record<Locale, string[]>;
  accessibilityNotes: Record<Locale, string[]>;
  availabilityLabel: LocalizedText;
  priceTier: "low" | "medium" | "high";
}

type Locale = ShoppingLocale;

export type BuildShoppingRecommendationsOptions = {
  catalog?: ShoppingCatalogProduct[];
  packageProductIds?: string[];
};

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, LocalizedText> = {
  groceries: { en: "Groceries", es: "Compra" },
  pharmacy_basics: { en: "Pharmacy basics", es: "Farmacia basica" },
  household: { en: "Household", es: "Hogar" },
  mobility_aids: { en: "Mobility aids", es: "Ayudas de movilidad" },
};

export const SHOPPING_CATEGORY_CHOICE_LABELS: Record<ShoppingCategoryChoice, LocalizedText> = {
  safe_home: { en: "Any safe-home area", es: "Cualquier area segura en casa" },
  ...SHOPPING_CATEGORY_LABELS,
};

export const SHOPPING_SUPPORT_PACKAGES: Record<ShoppingSupportPackageId, ShoppingSupportPackageDefinition> = {
  hydration_support: {
    id: "hydration_support",
    label: { en: "Hydration support", es: "Apoyo de hidratacion" },
    description: {
      en: "Compare water, oral rehydration salts, and electrolyte drinks without starting checkout.",
      es: "Compare agua, sales de rehidratacion oral y bebidas con electrolitos sin iniciar compra.",
    },
    needText: {
      en: "Hydration support: water, oral rehydration salts, or electrolyte drinks that are simple to use and easy to carry.",
      es: "Apoyo de hidratacion: agua, sales de rehidratacion oral o bebidas con electrolitos que sean sencillas y faciles de llevar.",
    },
    category: "groceries",
    priorities: ["delivery", "simplicity"],
    constraints: {
      en: ["no heavy lifting", "check sugar or fluid restrictions"],
      es: ["sin cargar peso", "revisar azucar o restriccion de liquidos"],
    },
    ctaLabel: { en: "Compare hydration", es: "Comparar hidratacion" },
    productIds: ["small-water-bottle-multipack", "low-sugar-electrolyte-drinks", "oral-rehydration-sachets"],
    priority: 90,
  },
  easy_meals: {
    id: "easy_meals",
    label: { en: "Easy meals", es: "Comidas faciles" },
    description: {
      en: "Simple groceries and pantry options for low-effort meals.",
      es: "Compra sencilla y opciones de despensa para comer con poco esfuerzo.",
    },
    needText: {
      en: "Easy meals after a health check: soft foods, pantry meals, and simple low-effort choices.",
      es: "Comidas faciles tras una revision de salud: alimentos blandos, comidas de despensa y opciones sencillas.",
    },
    category: "groceries",
    priorities: ["simplicity", "delivery"],
    constraints: {
      en: ["easy to open", "simple preparation"],
      es: ["facil de abrir", "preparacion sencilla"],
    },
    ctaLabel: { en: "Compare easy meals", es: "Comparar comidas" },
    productIds: ["low-sodium-lentil-soup", "ready-cut-soft-fruit", "plain-protein-yogurt", "wholegrain-porridge-oats"],
    priority: 80,
  },
  pharmacy_basics: {
    id: "pharmacy_basics",
    label: { en: "Pharmacy basics", es: "Basicos de farmacia" },
    description: {
      en: "Basic supplies with a reminder to ask a pharmacist or doctor when unsure.",
      es: "Suministros basicos con recordatorio de consultar a farmacia o medico si hay dudas.",
    },
    needText: {
      en: "Pharmacy basics for a health support kit: simple, clearly labelled items and no medication advice.",
      es: "Basicos de farmacia para un kit de apoyo: articulos sencillos, bien etiquetados y sin consejo de medicacion.",
    },
    category: "pharmacy_basics",
    priorities: ["simplicity", "safety"],
    constraints: {
      en: ["check with a pharmacist", "do not change medicines"],
      es: ["consultar con farmacia", "no cambiar medicinas"],
    },
    ctaLabel: { en: "Compare basics", es: "Comparar basicos" },
    productIds: ["large-print-pill-organizer", "large-display-thermometer", "oral-rehydration-sachets", "fragrance-free-moisturizer"],
    priority: 70,
  },
  home_support: {
    id: "home_support",
    label: { en: "Home support", es: "Apoyo en casa" },
    description: {
      en: "Prepare a support request for help at home, with confirmation before anyone is contacted.",
      es: "Prepare una solicitud de apoyo en casa, con confirmacion antes de contactar a nadie.",
    },
    needText: {
      en: "Home support after a health recommendation: someone to check in, help at home, or stay nearby.",
      es: "Apoyo en casa tras una recomendacion de salud: alguien que revise, ayude en casa o este cerca.",
    },
    category: "safe_home",
    priorities: ["safety", "accessibility"],
    constraints: {
      en: ["confirm before contacting anyone", "no product checkout"],
      es: ["confirmar antes de contactar a nadie", "sin compra de productos"],
    },
    ctaLabel: { en: "Prepare support", es: "Preparar apoyo" },
    serviceRequest: true,
    productIds: ["motion-night-lights", "non-slip-shower-mat", "grabber-reacher", "raised-toilet-seat-arms"],
    priority: 60,
  },
};

export const STATIC_SHOPPING_CATALOG: ShoppingCatalogProduct[] = [
  {
    id: "low-sodium-lentil-soup",
    category: "groceries",
    name: { en: "Low-sodium lentil soup multipack", es: "Pack de sopa de lentejas baja en sal" },
    priceLabel: { en: "Low cost", es: "Precio bajo" },
    description: {
      en: "A simple warm meal with protein, easy to keep in the cupboard.",
      es: "Una comida caliente sencilla con proteina, facil de guardar en la despensa.",
    },
    benefits: {
      en: ["Low salt", "Ready quickly", "Good pantry backup"],
      es: ["Baja en sal", "Lista rapido", "Buena reserva de despensa"],
    },
    tags: ["food", "meal", "soup", "protein", "low_sodium", "pantry", "budget", "easy_meal", "vegetarian", "simple"],
    suitability: {
      en: ["Good when cooking feels tiring", "Useful for a quick lunch"],
      es: ["Buena cuando cocinar cansa", "Util para una comida rapida"],
    },
    cautions: {
      en: ["Check the label for allergens before choosing."],
      es: ["Revise la etiqueta por si contiene alergenos antes de elegir."],
    },
    accessibilityNotes: {
      en: ["Choose ring-pull cans or cartons if hand strength is limited."],
      es: ["Elija latas con anilla o envases de carton si tiene poca fuerza en las manos."],
    },
    availabilityLabel: { en: "Usually easy to find in supermarkets", es: "Suele encontrarse en supermercados" },
    priceTier: "low",
  },
  {
    id: "ready-cut-soft-fruit",
    category: "groceries",
    name: { en: "Ready-cut soft fruit cups", es: "Vasos de fruta blanda ya cortada" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "Soft fruit prepared in small portions with no peeling or chopping.",
      es: "Fruta blanda preparada en porciones pequenas, sin pelar ni cortar.",
    },
    benefits: {
      en: ["No preparation", "Soft texture", "Small portions"],
      es: ["Sin preparacion", "Textura blanda", "Porciones pequenas"],
    },
    tags: ["food", "fruit", "soft_food", "no_prep", "simple", "delivery", "fresh", "easy_to_eat"],
    suitability: {
      en: ["Good for an easy snack", "Helpful when chewing is harder"],
      es: ["Buena para un tentempie facil", "Util cuando masticar cuesta mas"],
    },
    cautions: {
      en: ["Check sugar content if blood sugar is a concern."],
      es: ["Revise el azucar si la glucosa es una preocupacion."],
    },
    accessibilityNotes: {
      en: ["Look for easy-peel lids and clear expiry dates."],
      es: ["Busque tapas faciles de abrir y fecha de caducidad clara."],
    },
    availabilityLabel: { en: "Best when delivered or bought fresh", es: "Mejor con entrega o compra fresca" },
    priceTier: "medium",
  },
  {
    id: "plain-protein-yogurt",
    category: "groceries",
    name: { en: "Plain high-protein yogurt multipack", es: "Pack de yogur natural alto en proteina" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "A soft, simple breakfast or snack with protein and calcium.",
      es: "Desayuno o tentempie blando y sencillo con proteina y calcio.",
    },
    benefits: {
      en: ["Soft texture", "Protein", "No cooking"],
      es: ["Textura blanda", "Proteina", "Sin cocinar"],
    },
    tags: ["food", "protein", "breakfast", "soft_food", "no_prep", "simple", "calcium", "dairy"],
    suitability: {
      en: ["Good when appetite is low", "Easy with fruit or oats"],
      es: ["Bueno cuando hay poco apetito", "Facil con fruta o avena"],
    },
    cautions: {
      en: ["Not suitable for dairy allergy or lactose intolerance unless labelled accordingly."],
      es: ["No adecuado para alergia a lacteos o intolerancia a la lactosa salvo que lo indique la etiqueta."],
    },
    accessibilityNotes: {
      en: ["Choose larger print labels and easy-open multipacks."],
      es: ["Elija etiquetas de letra grande y packs faciles de abrir."],
    },
    availabilityLabel: { en: "Available in most supermarkets", es: "Disponible en la mayoria de supermercados" },
    priceTier: "medium",
  },
  {
    id: "wholegrain-porridge-oats",
    category: "groceries",
    name: { en: "Wholegrain porridge oats", es: "Avena integral para gachas" },
    priceLabel: { en: "Low cost", es: "Precio bajo" },
    description: {
      en: "A warm, budget-friendly breakfast that can be made soft.",
      es: "Desayuno caliente y economico que puede prepararse blando.",
    },
    benefits: {
      en: ["Budget friendly", "Filling", "Easy to soften"],
      es: ["Economico", "Saciante", "Facil de ablandar"],
    },
    tags: ["food", "breakfast", "budget", "soft_food", "pantry", "simple", "fiber"],
    suitability: {
      en: ["Good for a simple breakfast routine", "Works with milk or water"],
      es: ["Bueno para una rutina de desayuno sencilla", "Funciona con leche o agua"],
    },
    cautions: {
      en: ["Choose gluten-free only if needed and clearly labelled."],
      es: ["Elija sin gluten solo si lo necesita y esta claramente etiquetado."],
    },
    accessibilityNotes: {
      en: ["A lightweight bag or small box is easier to handle."],
      es: ["Una bolsa ligera o caja pequena es mas facil de manejar."],
    },
    availabilityLabel: { en: "Long shelf life", es: "Caducidad larga" },
    priceTier: "low",
  },
  {
    id: "small-water-bottle-multipack",
    category: "groceries",
    name: { en: "Small water bottle multipack", es: "Pack de botellas pequenas de agua" },
    priceLabel: { en: "Low cost", es: "Precio bajo" },
    description: {
      en: "Small bottles of water that are easier to lift, open, and keep nearby.",
      es: "Botellas pequenas de agua mas faciles de levantar, abrir y tener cerca.",
    },
    benefits: {
      en: ["Easy to keep nearby", "Small bottles are lighter", "Simple option"],
      es: ["Facil de tener cerca", "Botellas pequenas mas ligeras", "Opcion sencilla"],
    },
    tags: ["food", "water", "hydration", "fluids", "delivery", "low_lift", "simple", "budget"],
    suitability: {
      en: ["Good when drinks need to be close at hand", "Helpful when large bottles are too heavy"],
      es: ["Buena cuando las bebidas deben estar a mano", "Util si las botellas grandes pesan demasiado"],
    },
    cautions: {
      en: ["Ask a clinician if you have been told to limit fluids."],
      es: ["Consulte a un clinico si le han indicado limitar liquidos."],
    },
    accessibilityNotes: {
      en: ["Choose easy-open caps if hand strength is limited."],
      es: ["Elija tapones faciles de abrir si tiene poca fuerza en las manos."],
    },
    availabilityLabel: { en: "Usually easy to order with groceries", es: "Suele pedirse facilmente con la compra" },
    priceTier: "low",
  },
  {
    id: "low-sugar-electrolyte-drinks",
    category: "groceries",
    name: { en: "Low-sugar electrolyte drinks", es: "Bebidas con electrolitos bajas en azucar" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "Ready-to-drink electrolyte bottles for short-term hydration support.",
      es: "Botellas listas para tomar con electrolitos para apoyo puntual de hidratacion.",
    },
    benefits: {
      en: ["No mixing needed", "Easy to sip", "Delivery friendly"],
      es: ["Sin mezclar", "Facil de beber a sorbos", "Apta para entrega"],
    },
    tags: ["food", "hydration", "fluids", "electrolyte", "delivery", "simple", "sugar"],
    suitability: {
      en: ["Good when mixing powders is inconvenient", "Helpful for a short support kit"],
      es: ["Buena si mezclar polvos no es comodo", "Util para un kit de apoyo puntual"],
    },
    cautions: {
      en: ["Check sugar, salt, kidney, heart, or fluid-restriction advice before choosing."],
      es: ["Revise azucar, sal y consejo sobre rinon, corazon o restriccion de liquidos antes de elegir."],
    },
    accessibilityNotes: {
      en: ["Pick smaller bottles if carrying or grip is difficult."],
      es: ["Elija botellas pequenas si cargar o agarrar cuesta."],
    },
    availabilityLabel: { en: "Common grocery or pharmacy item", es: "Comun en supermercado o farmacia" },
    priceTier: "medium",
  },
  {
    id: "oral-rehydration-sachets",
    category: "pharmacy_basics",
    name: { en: "Oral rehydration salt sachets", es: "Sobres de sales de rehidratacion oral" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "Sachets that mix with water for oral rehydration support.",
      es: "Sobres que se mezclan con agua para apoyo de rehidratacion oral.",
    },
    benefits: {
      en: ["Small to store", "Clear portions", "Useful pharmacy basic"],
      es: ["Ocupan poco", "Porciones claras", "Basico util de farmacia"],
    },
    tags: ["pharmacy", "hydration", "fluids", "rehydration", "oral_rehydration", "electrolyte", "simple", "safety"],
    suitability: {
      en: ["Good to ask a pharmacist about", "Useful when a clinician recommends rehydration support"],
      es: ["Buena para consultar con farmacia", "Util cuando un clinico recomienda apoyo de rehidratacion"],
    },
    cautions: {
      en: ["Ask a pharmacist or doctor first if symptoms are severe, ongoing, or fluids are difficult."],
      es: ["Consulte primero a farmacia o medico si los sintomas son fuertes, continuos o cuesta tomar liquidos."],
    },
    accessibilityNotes: {
      en: ["Check that mixing instructions are large enough to read."],
      es: ["Compruebe que las instrucciones de mezcla sean faciles de leer."],
    },
    availabilityLabel: { en: "Common pharmacy item", es: "Articulo comun de farmacia" },
    priceTier: "medium",
  },
  {
    id: "large-print-pill-organizer",
    category: "pharmacy_basics",
    name: { en: "Large-print weekly pill organizer", es: "Pastillero semanal con letra grande" },
    priceLabel: { en: "Low cost", es: "Precio bajo" },
    description: {
      en: "A simple weekly organizer with large day labels.",
      es: "Organizador semanal sencillo con etiquetas grandes por dia.",
    },
    benefits: {
      en: ["Large labels", "Simple weekly view", "Helps reduce confusion"],
      es: ["Etiquetas grandes", "Vista semanal sencilla", "Ayuda a reducir confusion"],
    },
    tags: ["pharmacy", "medicine", "medication", "pill", "large_print", "simple", "budget", "safety", "memory", "confusion"],
    suitability: {
      en: ["Good if medicines are easy to mix up", "Helpful for a weekly routine"],
      es: ["Bueno si es facil confundir medicinas", "Util para una rutina semanal"],
    },
    cautions: {
      en: ["Ask a pharmacist before changing how medicines are stored."],
      es: ["Consulte con un farmaceutico antes de cambiar como guarda sus medicinas."],
    },
    accessibilityNotes: {
      en: ["Choose lids that open without sharp pressure."],
      es: ["Elija tapas que abran sin hacer mucha presion."],
    },
    availabilityLabel: { en: "Common pharmacy item", es: "Articulo comun de farmacia" },
    priceTier: "low",
  },
  {
    id: "large-display-thermometer",
    category: "pharmacy_basics",
    name: { en: "Large-display digital thermometer", es: "Termometro digital de pantalla grande" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "A thermometer with a large display and simple one-button use.",
      es: "Termometro con pantalla grande y uso sencillo de un boton.",
    },
    benefits: {
      en: ["Large display", "Quick reading", "Simple button"],
      es: ["Pantalla grande", "Lectura rapida", "Boton sencillo"],
    },
    tags: ["pharmacy", "temperature", "fever", "large_print", "simple", "safety", "easy_read"],
    suitability: {
      en: ["Good for checking fever clearly", "Useful for a home health kit"],
      es: ["Bueno para comprobar fiebre con claridad", "Util para un botiquin en casa"],
    },
    cautions: {
      en: ["Follow the instructions and seek medical advice for concerning symptoms."],
      es: ["Siga las instrucciones y busque consejo medico ante sintomas preocupantes."],
    },
    accessibilityNotes: {
      en: ["Look for an audible beep and a display that lights up."],
      es: ["Busque pitido audible y pantalla iluminada."],
    },
    availabilityLabel: { en: "Common pharmacy item", es: "Articulo comun de farmacia" },
    priceTier: "medium",
  },
  {
    id: "fragrance-free-moisturizer",
    category: "pharmacy_basics",
    name: { en: "Fragrance-free dry skin moisturizer", es: "Crema hidratante sin perfume para piel seca" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "A gentle moisturizer for dry or sensitive skin.",
      es: "Crema suave para piel seca o sensible.",
    },
    benefits: {
      en: ["Fragrance-free", "Sensitive skin", "Easy daily use"],
      es: ["Sin perfume", "Piel sensible", "Uso diario facil"],
    },
    tags: ["pharmacy", "skin", "dry_skin", "sensitive", "fragrance_free", "allergy", "simple"],
    suitability: {
      en: ["Good when scented products irritate skin", "Useful after hand washing"],
      es: ["Buena cuando los productos perfumados irritan", "Util despues de lavarse las manos"],
    },
    cautions: {
      en: ["Stop using it if irritation starts and ask a pharmacist if unsure."],
      es: ["Deje de usarla si aparece irritacion y consulte con un farmaceutico si duda."],
    },
    accessibilityNotes: {
      en: ["Pump bottles are easier than screw lids."],
      es: ["Los botes con dosificador son mas faciles que las tapas de rosca."],
    },
    availabilityLabel: { en: "Available in pharmacies and supermarkets", es: "Disponible en farmacias y supermercados" },
    priceTier: "medium",
  },
  {
    id: "easy-on-compression-socks",
    category: "pharmacy_basics",
    name: { en: "Easy-on light compression socks", es: "Calcetines de compresion ligera faciles de poner" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "Light support socks designed to be easier to pull on.",
      es: "Calcetines de soporte ligero pensados para ponerse con menos esfuerzo.",
    },
    benefits: {
      en: ["Easy-on design", "Light support", "Comfort cuff"],
      es: ["Diseno facil de poner", "Soporte ligero", "Punio comodo"],
    },
    tags: ["pharmacy", "legs", "compression", "mobility", "accessibility", "support"],
    suitability: {
      en: ["May help with tired legs when appropriate", "Easier than firm compression styles"],
      es: ["Puede ayudar con piernas cansadas cuando sea adecuado", "Mas facil que modelos de compresion fuerte"],
    },
    cautions: {
      en: ["Ask a doctor or pharmacist first if there are circulation, diabetes, or wound concerns."],
      es: ["Consulte antes con medico o farmaceutico si hay problemas de circulacion, diabetes o heridas."],
    },
    accessibilityNotes: {
      en: ["Choose easy-on or zip styles if bending is hard."],
      es: ["Elija modelos faciles o con cremallera si agacharse cuesta."],
    },
    availabilityLabel: { en: "Pharmacy or mobility shop item", es: "Articulo de farmacia o tienda de movilidad" },
    priceTier: "medium",
  },
  {
    id: "laundry-detergent-sheets",
    category: "household",
    name: { en: "Lightweight laundry detergent sheets", es: "Laminas ligeras de detergente para ropa" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "Small detergent sheets that avoid lifting a heavy bottle.",
      es: "Laminas pequenas de detergente que evitan levantar una botella pesada.",
    },
    benefits: {
      en: ["Light to carry", "No measuring liquid", "Less mess"],
      es: ["Ligero de llevar", "Sin medir liquido", "Menos derrames"],
    },
    tags: ["household", "laundry", "low_lift", "simple", "accessibility", "delivery"],
    suitability: {
      en: ["Good if heavy bottles are difficult", "Useful for smaller homes"],
      es: ["Bueno si las botellas pesadas son dificiles", "Util para casas pequenas"],
    },
    cautions: {
      en: ["Keep detergent away from children and pets."],
      es: ["Mantenga el detergente lejos de ninos y mascotas."],
    },
    accessibilityNotes: {
      en: ["Flat packets are easier to store at waist height."],
      es: ["Los paquetes planos son mas faciles de guardar a la altura de la cintura."],
    },
    availabilityLabel: { en: "Available online and in larger supermarkets", es: "Disponible online y en supermercados grandes" },
    priceTier: "medium",
  },
  {
    id: "motion-night-lights",
    category: "household",
    name: { en: "Plug-in motion night lights", es: "Luces nocturnas con sensor de movimiento" },
    priceLabel: { en: "Low cost", es: "Precio bajo" },
    description: {
      en: "Small lights that switch on automatically in dark hallways.",
      es: "Luces pequenas que se encienden solas en pasillos oscuros.",
    },
    benefits: {
      en: ["Automatic light", "Low cost", "Helps at night"],
      es: ["Luz automatica", "Precio bajo", "Ayuda por la noche"],
    },
    tags: ["household", "safety", "fall_prevention", "night", "night_trip", "lighting", "bathroom", "trip_hazard", "home_safety", "budget", "simple", "accessibility"],
    suitability: {
      en: ["Good for night-time bathroom trips", "Helpful in hallways and bedrooms"],
      es: ["Buenas para ir al bano de noche", "Utiles en pasillos y dormitorios"],
    },
    cautions: {
      en: ["Do not overload sockets or place lights where they block walking space."],
      es: ["No sobrecargue enchufes ni coloque luces donde bloqueen el paso."],
    },
    accessibilityNotes: {
      en: ["No app or small switch needed once plugged in."],
      es: ["No necesita app ni interruptor pequeno una vez enchufada."],
    },
    availabilityLabel: { en: "Easy to find online or in hardware shops", es: "Facil de encontrar online o en ferreterias" },
    priceTier: "low",
  },
  {
    id: "easy-grip-jar-opener",
    category: "household",
    name: { en: "Easy-grip jar opener", es: "Abridor de tarros de agarre facil" },
    priceLabel: { en: "Low cost", es: "Precio bajo" },
    description: {
      en: "A simple grip aid for opening jars with less hand strain.",
      es: "Ayuda sencilla para abrir tarros con menos esfuerzo en la mano.",
    },
    benefits: {
      en: ["Low cost", "Helps hand grip", "No batteries"],
      es: ["Precio bajo", "Ayuda al agarre", "Sin pilas"],
    },
    tags: ["household", "arthritis", "grip", "hands", "budget", "simple", "accessibility", "kitchen", "home_safety"],
    suitability: {
      en: ["Good if jars are hard to open", "Useful in the kitchen"],
      es: ["Bueno si cuesta abrir tarros", "Util en la cocina"],
    },
    cautions: {
      en: ["Choose a stable model that does not slip."],
      es: ["Elija un modelo estable que no resbale."],
    },
    accessibilityNotes: {
      en: ["Large handles are easier than thin rubber discs for some hands."],
      es: ["Los mangos grandes pueden ser mas faciles que discos finos de goma."],
    },
    availabilityLabel: { en: "Common kitchen aid", es: "Ayuda de cocina comun" },
    priceTier: "low",
  },
  {
    id: "long-handle-dustpan",
    category: "household",
    name: { en: "Long-handle dustpan and brush", es: "Recogedor y cepillo de mango largo" },
    priceLabel: { en: "Low cost", es: "Precio bajo" },
    description: {
      en: "A light cleaning set that reduces bending for small spills.",
      es: "Set de limpieza ligero que reduce agacharse para pequenos derrames.",
    },
    benefits: {
      en: ["Less bending", "Lightweight", "Simple storage"],
      es: ["Menos agacharse", "Ligero", "Guardado sencillo"],
    },
    tags: ["household", "cleaning", "mobility", "low_lift", "bending", "less_bending", "trip_hazard", "home_safety", "budget", "simple", "accessibility"],
    suitability: {
      en: ["Good when bending is uncomfortable", "Useful for quick tidy-ups"],
      es: ["Bueno si agacharse incomoda", "Util para limpiezas rapidas"],
    },
    cautions: {
      en: ["Store it where it cannot become a trip hazard."],
      es: ["Guardelo donde no suponga riesgo de tropiezo."],
    },
    accessibilityNotes: {
      en: ["Pick a handle height that reaches comfortably without stooping."],
      es: ["Elija una altura de mango comoda sin encorvarse."],
    },
    availabilityLabel: { en: "Available in household shops", es: "Disponible en tiendas de hogar" },
    priceTier: "low",
  },
  {
    id: "non-slip-shower-mat",
    category: "mobility_aids",
    name: { en: "Non-slip shower mat with drainage holes", es: "Alfombrilla antideslizante de ducha con drenaje" },
    priceLabel: { en: "Low cost", es: "Precio bajo" },
    description: {
      en: "A textured mat to reduce slipping in the shower.",
      es: "Alfombrilla con textura para reducir resbalones en la ducha.",
    },
    benefits: {
      en: ["Low cost", "Bathroom safety", "Easy first step"],
      es: ["Precio bajo", "Seguridad en bano", "Primer paso sencillo"],
    },
    tags: ["mobility", "bathroom", "shower", "fall_prevention", "home_safety", "safety", "budget", "simple", "accessibility"],
    suitability: {
      en: ["Good for a slippery shower floor", "Helpful before bigger bathroom changes"],
      es: ["Buena para suelo de ducha resbaladizo", "Util antes de cambios mayores en el bano"],
    },
    cautions: {
      en: ["Check suction regularly and replace it if it no longer grips."],
      es: ["Revise la succion con frecuencia y cambiela si ya no agarra."],
    },
    accessibilityNotes: {
      en: ["Choose high-contrast color if vision is reduced."],
      es: ["Elija color de alto contraste si la vision esta reducida."],
    },
    availabilityLabel: { en: "Easy to find in pharmacies and household shops", es: "Facil de encontrar en farmacias y tiendas de hogar" },
    priceTier: "low",
  },
  {
    id: "grabber-reacher",
    category: "mobility_aids",
    name: { en: "Lightweight grabber reacher", es: "Pinza extensible ligera" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "A reacher for picking up light items without bending.",
      es: "Pinza para coger objetos ligeros sin agacharse.",
    },
    benefits: {
      en: ["Less bending", "Lightweight", "Useful around home"],
      es: ["Menos agacharse", "Ligera", "Util en casa"],
    },
    tags: ["mobility", "reach", "bending", "less_bending", "home_safety", "accessibility", "simple", "low_lift", "household"],
    suitability: {
      en: ["Good if bending or reaching is hard", "Useful for dropped light objects"],
      es: ["Buena si cuesta agacharse o alcanzar", "Util para objetos ligeros caidos"],
    },
    cautions: {
      en: ["Do not use it for hot, sharp, or heavy objects."],
      es: ["No la use para objetos calientes, afilados o pesados."],
    },
    accessibilityNotes: {
      en: ["Choose a trigger that feels comfortable in the hand."],
      es: ["Elija un gatillo comodo para la mano."],
    },
    availabilityLabel: { en: "Mobility shop or online item", es: "Articulo de tienda de movilidad u online" },
    priceTier: "medium",
  },
  {
    id: "adjustable-folding-walking-stick",
    category: "mobility_aids",
    name: { en: "Adjustable folding walking stick", es: "Baston plegable ajustable" },
    priceLabel: { en: "Medium cost", es: "Precio medio" },
    description: {
      en: "A portable walking stick with adjustable height.",
      es: "Baston portatil con altura ajustable.",
    },
    benefits: {
      en: ["Adjustable height", "Folds away", "Portable support"],
      es: ["Altura ajustable", "Se pliega", "Apoyo portatil"],
    },
    tags: ["mobility", "walking", "support", "fall_prevention", "home_safety", "accessibility", "outdoor", "simple", "balance"],
    suitability: {
      en: ["Good if a light portable support is needed", "Useful for outings"],
      es: ["Bueno si se necesita apoyo ligero y portatil", "Util para salidas"],
    },
    cautions: {
      en: ["Correct height matters. Ask a professional if unsure about walking support."],
      es: ["La altura correcta importa. Consulte a un profesional si duda sobre el apoyo para caminar."],
    },
    accessibilityNotes: {
      en: ["Look for a comfortable handle and non-slip ferrule."],
      es: ["Busque mango comodo y contera antideslizante."],
    },
    availabilityLabel: { en: "Mobility shop or pharmacy item", es: "Articulo de tienda de movilidad o farmacia" },
    priceTier: "medium",
  },
  {
    id: "raised-toilet-seat-arms",
    category: "mobility_aids",
    name: { en: "Raised toilet seat with support arms", es: "Elevador de WC con brazos de apoyo" },
    priceLabel: { en: "Higher cost", es: "Precio mas alto" },
    description: {
      en: "A bathroom aid that can make sitting and standing easier.",
      es: "Ayuda de bano que puede facilitar sentarse y levantarse.",
    },
    benefits: {
      en: ["Supports standing", "Bathroom accessibility", "Stable arms"],
      es: ["Apoya al levantarse", "Accesibilidad en bano", "Brazos estables"],
    },
    tags: ["mobility", "bathroom", "toilet", "standing", "home_safety", "accessibility", "safety", "support"],
    suitability: {
      en: ["Good when standing from the toilet is hard", "Useful after careful measuring"],
      es: ["Bueno si cuesta levantarse del WC", "Util tras medir bien"],
    },
    cautions: {
      en: ["Measure carefully and consider advice from an occupational therapist or clinician."],
      es: ["Mida con cuidado y considere consejo de terapeuta ocupacional o clinico."],
    },
    accessibilityNotes: {
      en: ["Check toilet shape, seat height, and cleaning access before choosing."],
      es: ["Compruebe forma del WC, altura del asiento y limpieza antes de elegir."],
    },
    availabilityLabel: { en: "Best from a mobility supplier", es: "Mejor en proveedor de movilidad" },
    priceTier: "high",
  },
];

const CATEGORY_KEYWORDS: Record<ShoppingCategory, string[]> = {
  groceries: ["food", "meal", "grocery", "groceries", "fruit", "breakfast", "soup", "eat", "snack", "water", "hydration", "fluids", "electrolyte", "compra", "comida", "fruta", "desayuno", "sopa", "agua", "liquidos", "hidratacion"],
  pharmacy_basics: ["pharmacy", "medicine", "pill", "skin", "thermometer", "fever", "cream", "medication", "rehydration", "oral rehydration", "farmacia", "medicina", "pastilla", "piel", "termometro", "fiebre", "crema", "rehidratacion"],
  household: ["home", "house", "clean", "laundry", "kitchen", "jar", "light", "night", "hallway", "hogar", "casa", "limpieza", "ropa", "cocina", "tarro", "luz", "noche", "pasillo"],
  mobility_aids: ["mobility", "walking", "fall", "shower", "bathroom", "bend", "reach", "toilet", "standing", "slip", "movilidad", "caminar", "caida", "ducha", "bano", "agachar", "alcanzar", "wc", "resbalar"],
};

const PRIORITY_KEYWORDS: Record<ShoppingPriority, string[]> = {
  budget: ["cheap", "budget", "low cost", "save", "economical", "barato", "economico", "ahorrar", "precio bajo"],
  simplicity: ["simple", "easy", "clear", "quick", "facil", "sencillo", "rapido", "claro"],
  accessibility: ["arthritis", "grip", "bending", "reach", "mobility", "vision", "large", "dolor", "agarre", "agachar", "alcanzar", "movilidad", "vision", "grande"],
  diet: ["low salt", "low sodium", "soft", "protein", "sugar", "dairy", "gluten", "bajo en sal", "blando", "proteina", "azucar", "lacteos", "gluten"],
  delivery: ["delivery", "deliver", "carry", "heavy", "domicilio", "entrega", "llevar", "pesado"],
  safety: ["safe", "safer", "fall", "trip", "night", "slip", "fever", "confusion", "seguro", "segura", "caida", "tropiezo", "noche", "resbalar", "fiebre", "confusion"],
};

const HOME_SAFETY_INTENTS = [
  {
    label: "night",
    terms: ["night", "dark", "hallway", "path", "bathroom at night", "noche", "oscuro", "pasillo"],
    tags: ["night", "night_trip", "lighting"],
  },
  {
    label: "bathroom",
    terms: ["bathroom", "shower", "toilet", "bath", "bano", "ducha", "wc"],
    tags: ["bathroom", "shower", "toilet"],
  },
  {
    label: "fall",
    terms: ["safe", "safer", "fall", "slip", "trip", "steady", "seguro", "segura", "caida", "resbalar", "tropiezo"],
    tags: ["safety", "fall_prevention", "trip_hazard"],
  },
  {
    label: "bending",
    terms: ["bend", "bending", "reach", "carry", "heavy", "agachar", "alcanzar", "pesado"],
    tags: ["bending", "less_bending", "reach", "low_lift"],
  },
  {
    label: "standing",
    terms: ["stand", "standing", "sit", "sitting", "levantarse", "sentarse"],
    tags: ["standing", "support"],
  },
  {
    label: "grip",
    terms: ["grip", "hands", "arthritis", "agarre", "manos"],
    tags: ["grip", "hands", "arthritis"],
  },
] as const;

const HOME_SAFETY_PRODUCT_TAGS = new Set([
  "home_safety",
  "fall_prevention",
  "night_trip",
  "lighting",
  "bathroom",
  "shower",
  "toilet",
  "trip_hazard",
  "bending",
  "less_bending",
  "standing",
  "support",
  "grip",
]);

const CONSTRAINT_EXCLUSION_TAGS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /\b(no|not|avoid|sin|evitar)\s+(dairy|milk|lactose|lacteos|leche|lactosa)\b/i, tag: "dairy" },
  { pattern: /\b(no|not|avoid|sin|evitar)\s+(gluten)\b/i, tag: "gluten" },
  { pattern: /\b(no|not|avoid|sin|evitar)\s+(sugar|azucar)\b/i, tag: "sugar" },
];

function localeFrom(value: unknown): Locale {
  return typeof value === "string" && value.toLowerCase().startsWith("es") ? "es" : "en";
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesTerm(text: string, term: string): boolean {
  return normalizeText(text).includes(normalizeText(term));
}

function isSafeHomeCategory(category: ShoppingNeedInput["category"]): boolean {
  if (!category) return false;
  const raw = normalizeText(String(category)).replace(/[\s-]+/g, "_");
  return raw === "safe_home" || raw === "home_safety" || raw === "any_safe_home" || raw === "let_vyva_choose";
}

function homeSafetyNeedLabels(text: string): string[] {
  return HOME_SAFETY_INTENTS
    .filter((intent) => intent.terms.some((term) => includesTerm(text, term)))
    .map((intent) => intent.label);
}

function homeSafetyMatches(product: ShoppingCatalogProduct, text: string): string[] {
  if (!text) return [];
  return HOME_SAFETY_INTENTS
    .filter((intent) => (
      intent.terms.some((term) => includesTerm(text, term)) &&
      intent.tags.some((tag) => product.tags.includes(tag))
    ))
    .map((intent) => intent.label);
}

function homeSafetySpecificBonus(product: ShoppingCatalogProduct, text: string): number {
  let bonus = 0;
  if ((includesTerm(text, "shower") || includesTerm(text, "ducha")) && product.tags.includes("shower")) bonus += 16;
  if ((includesTerm(text, "toilet") || includesTerm(text, "wc")) && product.tags.includes("toilet")) bonus += 16;
  if ((includesTerm(text, "night") || includesTerm(text, "dark") || includesTerm(text, "noche")) && product.tags.includes("night_trip")) bonus += 16;
  if ((includesTerm(text, "bend") || includesTerm(text, "reach") || includesTerm(text, "agachar")) && product.tags.includes("less_bending")) bonus += 14;
  if ((includesTerm(text, "stand") || includesTerm(text, "sit") || includesTerm(text, "levantarse")) && product.tags.includes("standing")) bonus += 14;
  if ((includesTerm(text, "slip") || includesTerm(text, "fall") || includesTerm(text, "resbalar") || includesTerm(text, "caida")) && product.tags.includes("fall_prevention")) bonus += 12;
  return bonus;
}

function productHasHomeSafetyRole(product: ShoppingCatalogProduct): boolean {
  return product.tags.some((tag) => HOME_SAFETY_PRODUCT_TAGS.has(tag));
}

function normalizeCategory(category: ShoppingNeedInput["category"]): ShoppingCategory | null {
  if (!category) return null;
  if (isSafeHomeCategory(category)) return null;
  const raw = normalizeText(String(category)).replace(/[\s-]+/g, "_");
  if (raw === "groceries" || raw === "grocery" || raw === "compra") return "groceries";
  if (raw === "pharmacy_basics" || raw === "pharmacy" || raw === "farmacia" || raw === "farmacia_basica") return "pharmacy_basics";
  if (raw === "household" || raw === "home" || raw === "hogar") return "household";
  if (raw === "mobility_aids" || raw === "mobility" || raw === "movilidad" || raw === "ayudas_de_movilidad") return "mobility_aids";
  return null;
}

function inferCategory(text: string): ShoppingCategory | null {
  const scored = Object.entries(CATEGORY_KEYWORDS).map(([category, terms]) => ({
    category: category as ShoppingCategory,
    hits: terms.filter((term) => includesTerm(text, term)).length,
  }));
  const best = scored.sort((a, b) => b.hits - a.hits)[0];
  return best && best.hits > 0 ? best.category : null;
}

function inferPriorities(text: string, explicit: ShoppingPriority[] = []): ShoppingPriority[] {
  const priorities = new Set<ShoppingPriority>(explicit);
  for (const [priority, terms] of Object.entries(PRIORITY_KEYWORDS) as Array<[ShoppingPriority, string[]]>) {
    if (terms.some((term) => includesTerm(text, term))) priorities.add(priority);
  }
  return Array.from(priorities);
}

function localizeProduct(product: ShoppingCatalogProduct, locale: Locale): ShoppingProduct {
  return {
    id: product.id,
    category: product.category,
    name: product.name[locale],
    priceLabel: product.priceLabel[locale],
    description: product.description[locale],
    benefits: product.benefits[locale],
    tags: product.tags,
    suitability: product.suitability[locale],
    cautions: product.cautions[locale],
    accessibilityNotes: product.accessibilityNotes[locale],
    availabilityLabel: product.availabilityLabel[locale],
    priceTier: product.priceTier,
  };
}

function excludedTagsFor(text: string, constraints: string[]): Set<string> {
  const combined = `${text} ${constraints.join(" ")}`;
  return new Set(
    CONSTRAINT_EXCLUSION_TAGS
      .filter(({ pattern }) => pattern.test(combined))
      .map(({ tag }) => tag),
  );
}

function tagHits(product: ShoppingCatalogProduct, terms: string[]): string[] {
  return product.tags.filter((tag) => terms.some((term) => includesTerm(tag, term) || includesTerm(term, tag)));
}

function textHits(product: ShoppingCatalogProduct, text: string): string[] {
  if (!text) return [];
  const terms = normalizeText(text).split(" ").filter((term) => term.length >= 4);
  const haystack = [
    product.name.en,
    product.name.es,
    product.description.en,
    product.description.es,
    ...product.tags,
    ...product.benefits.en,
    ...product.benefits.es,
    ...product.suitability.en,
    ...product.suitability.es,
  ].join(" ");
  return terms.filter((term) => includesTerm(haystack, term));
}

function rankLabelFor(index: number, product: ShoppingProduct, priorities: ShoppingPriority[], matchedIntents: string[]): ShoppingRecommendation["rankLabel"] {
  if (matchedIntents.includes("night")) return "Best for night trips";
  if (matchedIntents.includes("standing") || product.tags.includes("standing")) return "Best if standing is hard";
  if (matchedIntents.includes("bending") || product.tags.includes("less_bending")) return "Best for less bending";
  if (index === 0 && (product.tags.includes("home_safety") || product.tags.includes("fall_prevention"))) return "Best first step";
  if (index === 0) return "Best fit";
  if (product.priceTier === "low" || priorities.includes("budget")) return "Lowest cost";
  return "Easiest choice";
}

function confidenceFor(score: number): ShoppingRecommendation["confidence"] {
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function reasonCopy(locale: Locale, product: ShoppingProduct, priorities: ShoppingPriority[], matchedTags: string[], matchedIntents: string[], score: number): string[] {
  const reasons: string[] = [];
  if (matchedIntents.includes("night")) {
    reasons.push(locale === "es"
      ? "Ayuda a iluminar el camino al bano por la noche."
      : "Helps light the route for night-time bathroom trips.");
  }
  if (matchedIntents.includes("bathroom") || (product.tags.includes("bathroom") && product.tags.includes("fall_prevention"))) {
    reasons.push(locale === "es"
      ? "Ayuda a reducir el riesgo de resbalones en el bano."
      : "Helps reduce slip risk in the bathroom.");
  }
  if (matchedIntents.includes("bending") || product.tags.includes("less_bending")) {
    reasons.push(locale === "es"
      ? "Reduce agacharse o cargar objetos en tareas de casa."
      : "Reduces bending or lifting during everyday home tasks.");
  }
  if (matchedIntents.includes("standing") || product.tags.includes("standing")) {
    reasons.push(locale === "es"
      ? "Da apoyo adicional al sentarse o levantarse."
      : "Adds support when sitting down or standing up.");
  }
  if (product.tags.includes("medicine") && product.tags.includes("confusion")) {
    reasons.push(locale === "es"
      ? "Separa medicinas por dia para que sean mas faciles de revisar."
      : "Keeps medicines separated by day so they are easier to check.");
  }
  if (product.tags.includes("hydration") && reasons.length < 2) {
    reasons.push(locale === "es"
      ? "Ayuda a tener bebidas o apoyo de hidratacion a mano."
      : "Helps keep drinks or hydration support close at hand.");
  }
  if (matchedTags.length > 0 && reasons.length < 2) {
    reasons.push(locale === "es"
      ? "Coincide con lo que ha pedido."
      : "Matches what you asked for.");
  }
  if (priorities.includes("budget") && product.priceTier === "low") {
    reasons.push(locale === "es" ? "Es una opcion de bajo coste." : "It is a low-cost option.");
  }
  if (priorities.includes("simplicity") && product.tags.includes("simple")) {
    reasons.push(locale === "es" ? "Es sencilla de usar o preparar." : "It is simple to use or prepare.");
  }
  if (priorities.includes("accessibility") && (product.tags.includes("accessibility") || product.tags.includes("large_print"))) {
    reasons.push(locale === "es" ? "Tiene detalles utiles de accesibilidad." : "It has helpful accessibility features.");
  }
  if (priorities.includes("safety") && product.tags.includes("safety")) {
    reasons.push(locale === "es" ? "Ayuda a reducir un riesgo practico." : "It helps reduce a practical risk.");
  }
  if (reasons.length === 0 && score >= 50) {
    reasons.push(locale === "es" ? "Es una opcion practica y facil de comparar." : "It is a practical option that is easy to compare.");
  }
  return reasons.slice(0, 3);
}

function tradeoffCopy(locale: Locale, product: ShoppingProduct): string[] {
  const tradeoffs: string[] = [];
  if (product.priceTier === "high") {
    tradeoffs.push(locale === "es" ? "Cuesta mas; conviene medir y comprobar antes." : "It costs more, so measure and check before choosing.");
  }
  if (product.priceTier === "medium") {
    tradeoffs.push(locale === "es" ? "No es la opcion mas barata, pero puede ser mas comoda." : "It is not the cheapest, but may be more convenient.");
  }
  if (product.tags.includes("fresh")) {
    tradeoffs.push(locale === "es" ? "Debe consumirse antes que productos de despensa." : "It needs using sooner than pantry items.");
  }
  if (product.tags.includes("hydration") && product.category === "pharmacy_basics") {
    tradeoffs.push(locale === "es" ? "Conviene consultar con farmacia o medico si los sintomas son fuertes." : "Ask a pharmacist or doctor if symptoms are strong.");
  }
  if (tradeoffs.length === 0) {
    tradeoffs.push(locale === "es" ? "Revise tamano, etiqueta y facilidad de apertura." : "Check size, label, and ease of opening.");
  }
  return tradeoffs.slice(0, 2);
}

function noMatchResponse(locale: Locale, text: string): ShoppingRecommendationResponse {
  return {
    querySummary: text
      ? (locale === "es" ? "No tengo suficientes datos para elegir con seguridad." : "I do not have enough detail to choose safely.")
      : (locale === "es" ? "Diga que necesita comprar." : "Tell me what you need to buy."),
    recommendations: [],
    comparison: {
      summary: locale === "es" ? "No hay comparacion todavia." : "There is no comparison yet.",
      differences: [],
      bestFor: [],
    },
    uncertaintyNote: locale === "es"
      ? "VYVA solo recomienda desde el catalogo aprobado y no debe inventar productos."
      : "VYVA only recommends from the approved catalog and should not invent products.",
    nextQuestions: locale === "es"
      ? ["Bano mas seguro por la noche", "Menos agacharse en casa", "No confundir medicinas"]
      : ["Safer bathroom at night", "Less bending at home", "Avoid mixing medicines"],
  };
}

export function getShoppingCatalog(localeInput: unknown = "en"): ShoppingProduct[] {
  const locale = localeFrom(localeInput);
  return STATIC_SHOPPING_CATALOG.map((product) => localizeProduct(product, locale));
}

export function getStaticShoppingSupportPackages(): ShoppingSupportPackageDefinition[] {
  return Object.values(SHOPPING_SUPPORT_PACKAGES)
    .filter((item) => item.isEnabled !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id));
}

export function buildShoppingRecommendations(
  input: ShoppingNeedInput,
  options: BuildShoppingRecommendationsOptions = {},
): ShoppingRecommendationResponse {
  const locale = localeFrom(input.locale);
  const needText = input.needText?.trim() ?? "";
  const constraints = input.constraints ?? [];
  const sourceCatalog = options.catalog?.length ? options.catalog : STATIC_SHOPPING_CATALOG;
  const packageProductIds = new Set(options.packageProductIds ?? []);
  const combinedText = [needText, ...constraints].join(" ");
  const normalizedNeed = normalizeText(combinedText);
  const selectedCategory = normalizeCategory(input.category);
  const homeSafetyLabels = homeSafetyNeedLabels(normalizedNeed);
  const safeHomeChoice = isSafeHomeCategory(input.category);
  const homeSafetyMode = safeHomeChoice || homeSafetyLabels.length > 0;
  const category = homeSafetyMode ? null : selectedCategory ?? inferCategory(normalizedNeed);
  const priorities = inferPriorities(normalizedNeed, input.priorities ?? []);
  const excludedTags = excludedTagsFor(combinedText, constraints);

  if (!category && normalizedNeed.length < 4) {
    return noMatchResponse(locale, normalizedNeed);
  }

  const scored = sourceCatalog
    .map((raw) => {
      const product = localizeProduct(raw, locale);
      const packageLinked = packageProductIds.has(raw.id);
      const excluded = raw.tags.some((tag) => excludedTags.has(tag));
      const textMatches = textHits(raw, normalizedNeed);
      const safetyMatches = homeSafetyMatches(raw, normalizedNeed);
      const priorityMatches = priorities.flatMap((priority) => tagHits(raw, PRIORITY_KEYWORDS[priority] ?? []));
      let score = 10;

      if (category && raw.category === category) score += 28;
      if (selectedCategory && !homeSafetyMode && raw.category !== selectedCategory) score -= 35;
      if (!category && textMatches.length > 0) score += 10;
      score += Math.min(25, textMatches.length * 4);
      score += Math.min(30, safetyMatches.length * 12);
      score += homeSafetySpecificBonus(raw, normalizedNeed);
      score += Math.min(24, priorityMatches.length * 6);
      if (priorities.includes("budget") && raw.priceTier === "low") score += 12;
      if (priorities.includes("simplicity") && raw.tags.includes("simple")) score += 10;
      if (priorities.includes("accessibility") && raw.tags.includes("accessibility")) score += 10;
      if (priorities.includes("delivery") && (raw.tags.includes("delivery") || raw.tags.includes("low_lift"))) score += 8;
      if (priorities.includes("safety") && raw.tags.includes("safety")) score += 10;
      if (homeSafetyMode && productHasHomeSafetyRole(raw) && (safetyMatches.length > 0 || textMatches.length > 0)) score += 12;
      if (safeHomeChoice && !safetyMatches.length && !textMatches.length) score -= 35;
      if (homeSafetyMode && raw.category === "groceries") score -= 18;
      const hydrationIntent = /(hydrat|fluid|water|electrolyte|rehydrat|agua|liquidos|hidratacion|rehidratacion)/i.test(normalizedNeed);
      if (hydrationIntent && raw.tags.includes("hydration")) score += 22;
      if (hydrationIntent && raw.tags.includes("electrolyte")) score += 8;
      if (hydrationIntent && raw.tags.includes("water")) score += 8;
      if (hydrationIntent && !raw.tags.includes("hydration")) score -= 18;
      if (packageProductIds.size > 0) {
        score += packageLinked ? 24 : -6;
      }
      const medicationIntent = /(medicine|medication|pill|pastilla|medicina)/i.test(normalizedNeed);
      if (medicationIntent && raw.tags.some((tag) => ["medicine", "medication", "pill"].includes(tag))) {
        score += 14;
      }
      if (medicationIntent && raw.category === "pharmacy_basics" && !raw.tags.some((tag) => ["medicine", "medication", "pill"].includes(tag))) {
        score -= 50;
      }
      if (excluded) score -= 90;

      return {
        raw,
        product,
        score: Math.max(0, Math.min(100, score)),
        sortScore: score,
        matchedTags: Array.from(new Set([...textMatches, ...priorityMatches, ...safetyMatches])),
        matchedIntents: safetyMatches,
        packageLinked,
        excluded,
      };
    })
    .filter((item) => !item.excluded)
    .sort((a, b) => b.sortScore - a.sortScore);

  const baseViable = scored.filter((item) => item.score >= 35);
  const packageViable = packageProductIds.size > 0
    ? scored.filter((item) => item.packageLinked && item.score >= 25)
    : [];
  const packageFirst = packageViable.length > 0
    ? [
      ...packageViable,
      ...baseViable.filter((item) => !packageProductIds.has(item.raw.id)),
    ]
    : baseViable;
  const seenIds = new Set<string>();
  const viable = packageFirst.filter((item) => {
    if (seenIds.has(item.raw.id)) return false;
    seenIds.add(item.raw.id);
    return true;
  });
  const bestScore = viable[0]?.score ?? 0;
  if (bestScore < 35) {
    return noMatchResponse(locale, normalizedNeed);
  }

  const recommendations = viable.slice(0, 3).map((item, index): ShoppingRecommendation => ({
    product: item.product,
    score: item.score,
    rankLabel: rankLabelFor(index, item.product, priorities, item.matchedIntents),
    reasons: reasonCopy(locale, item.product, priorities, item.matchedTags, item.matchedIntents, item.score),
    tradeoffs: tradeoffCopy(locale, item.product),
    cautionNotes: item.product.cautions,
    confidence: confidenceFor(item.score),
  }));

  const categoryLabel = safeHomeChoice
    ? SHOPPING_CATEGORY_CHOICE_LABELS.safe_home[locale]
    : category ? SHOPPING_CATEGORY_LABELS[category][locale] : (locale === "es" ? "varias categorias" : "several categories");
  const top = recommendations[0]?.product;
  const second = recommendations[1]?.product;
  const isPharmacy = recommendations.some((item) => item.product.category === "pharmacy_basics");

  return {
    querySummary: locale === "es"
      ? `He buscado opciones de ${categoryLabel} segun: ${needText || "necesidad general"}.`
      : `I looked for ${categoryLabel} options based on: ${needText || "a general need"}.`,
    recommendations,
    comparison: {
      summary: top && second
        ? (locale === "es"
          ? `${top.name} es el primer paso mas claro; ${second.name} cubre otra necesidad cercana.`
          : `${top.name} is the clearest first step; ${second.name} covers another nearby need.`)
        : (top
          ? (locale === "es" ? `${top.name} es la opcion mas clara.` : `${top.name} is the clearest option.`)
          : (locale === "es" ? "No hay comparacion suficiente." : "There is not enough to compare.")),
      differences: top && second
        ? recommendations.map((item) => (
          locale === "es"
            ? `${item.product.name}: ${item.product.priceLabel}; ${item.product.availabilityLabel}.`
            : `${item.product.name}: ${item.product.priceLabel}; ${item.product.availabilityLabel}.`
        ))
        : [],
      bestFor: recommendations.map((item) => `${item.product.name}: ${item.reasons[0] ?? item.product.description}`),
    },
    uncertaintyNote: isPharmacy
      ? (locale === "es"
        ? "Para articulos de farmacia, VYVA no sustituye a un farmaceutico, medico ni consejo sobre medicacion."
        : "For pharmacy items, VYVA does not replace a pharmacist, doctor, or medication advice.")
      : (locale === "es"
        ? "Estas son opciones informativas del catalogo aprobado de VYVA; revise etiquetas, medidas y disponibilidad antes de comprar."
        : "These are informational choices from VYVA's approved catalog; check labels, measurements, and availability before buying."),
    nextQuestions: locale === "es"
      ? ["Quiere priorizar precio, facilidad o seguridad?", "Hay alergias, dieta o movilidad que deba tener en cuenta?", "Prefiere algo ligero o con entrega a domicilio?"]
      : ["Would you like to prioritise price, ease, or safety?", "Are there allergies, diet needs, or mobility needs to consider?", "Do you prefer something lightweight or delivery-friendly?"],
  };
}
