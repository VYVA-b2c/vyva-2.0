import type { LanguageCode } from "@/i18n/languages";

const LOCAL_API_UNAVAILABLE_MESSAGE =
  "Local API is not running. Start the backend on port 3001 and make sure DATABASE_URL is set.";

type AuthErrorMessages = {
  invalidContact: string;
  invalidSignIn: string;
  mobileExists: string;
  emailExists: string;
  incorrectCredentials: string;
  passwordTooShort: string;
  loginFailed: string;
  registrationFailed: string;
  adminRegistrationOnly: string;
};

const AUTH_ERROR_MESSAGES: Record<LanguageCode, AuthErrorMessages> = {
  en: {
    invalidContact: "Please enter a valid email address or mobile number.",
    invalidSignIn: "Please enter your email or mobile number and password.",
    mobileExists: "An account with this mobile number already exists.",
    emailExists: "An account with this email already exists.",
    incorrectCredentials: "Incorrect email, mobile number, or password.",
    passwordTooShort: "Password must be at least 8 characters.",
    loginFailed: "Login failed. Please try again.",
    registrationFailed: "Registration failed. Please try again.",
    adminRegistrationOnly: "Admin accounts can only be created by the super admin after sign in.",
  },
  es: {
    invalidContact: "Introduce un email o numero movil valido.",
    invalidSignIn: "Introduce tu email o movil y la contrasena.",
    mobileExists: "Ya existe una cuenta con este numero movil.",
    emailExists: "Ya existe una cuenta con este email.",
    incorrectCredentials: "Email, movil o contrasena incorrectos.",
    passwordTooShort: "La contrasena debe tener al menos 8 caracteres.",
    loginFailed: "No se pudo iniciar sesion. Intentalo de nuevo.",
    registrationFailed: "No se pudo crear la cuenta. Intentalo de nuevo.",
    adminRegistrationOnly: "Las cuentas de administrador solo puede crearlas el superadministrador despues de iniciar sesion.",
  },
  fr: {
    invalidContact: "Veuillez saisir une adresse e-mail ou un numero mobile valide.",
    invalidSignIn: "Veuillez saisir votre e-mail ou numero mobile et votre mot de passe.",
    mobileExists: "Un compte avec ce numero mobile existe deja.",
    emailExists: "Un compte avec cet e-mail existe deja.",
    incorrectCredentials: "E-mail, numero mobile ou mot de passe incorrect.",
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caracteres.",
    loginFailed: "Connexion impossible. Reessayez.",
    registrationFailed: "Impossible de creer le compte. Reessayez.",
    adminRegistrationOnly: "Les comptes administrateur ne peuvent etre crees que par le super administrateur apres connexion.",
  },
  de: {
    invalidContact: "Bitte geben Sie eine gueltige E-Mail-Adresse oder Mobilnummer ein.",
    invalidSignIn: "Bitte geben Sie E-Mail oder Mobilnummer und Passwort ein.",
    mobileExists: "Ein Konto mit dieser Mobilnummer existiert bereits.",
    emailExists: "Ein Konto mit dieser E-Mail-Adresse existiert bereits.",
    incorrectCredentials: "E-Mail, Mobilnummer oder Passwort ist falsch.",
    passwordTooShort: "Das Passwort muss mindestens 8 Zeichen lang sein.",
    loginFailed: "Anmeldung fehlgeschlagen. Bitte erneut versuchen.",
    registrationFailed: "Konto konnte nicht erstellt werden. Bitte erneut versuchen.",
    adminRegistrationOnly: "Admin-Konten koennen nur vom Super-Admin nach der Anmeldung erstellt werden.",
  },
  it: {
    invalidContact: "Inserisci un indirizzo email o un numero di cellulare valido.",
    invalidSignIn: "Inserisci email o cellulare e password.",
    mobileExists: "Esiste gia un account con questo numero di cellulare.",
    emailExists: "Esiste gia un account con questa email.",
    incorrectCredentials: "Email, cellulare o password non corretti.",
    passwordTooShort: "La password deve contenere almeno 8 caratteri.",
    loginFailed: "Accesso non riuscito. Riprova.",
    registrationFailed: "Impossibile creare l'account. Riprova.",
    adminRegistrationOnly: "Gli account amministratore possono essere creati solo dal super admin dopo l'accesso.",
  },
  pt: {
    invalidContact: "Introduza um email ou numero de telemovel valido.",
    invalidSignIn: "Introduza o email ou telemovel e a palavra-passe.",
    mobileExists: "Ja existe uma conta com este numero de telemovel.",
    emailExists: "Ja existe uma conta com este email.",
    incorrectCredentials: "Email, telemovel ou palavra-passe incorretos.",
    passwordTooShort: "A palavra-passe deve ter pelo menos 8 caracteres.",
    loginFailed: "Nao foi possivel iniciar sessao. Tente novamente.",
    registrationFailed: "Nao foi possivel criar a conta. Tente novamente.",
    adminRegistrationOnly: "As contas de administrador so podem ser criadas pelo super administrador apos iniciar sessao.",
  },
  cy: {
    invalidContact: "Rhowch gyfeiriad e-bost neu rif symudol dilys.",
    invalidSignIn: "Rhowch eich e-bost neu rif symudol a'ch cyfrinair.",
    mobileExists: "Mae cyfrif gyda'r rhif symudol hwn eisoes yn bodoli.",
    emailExists: "Mae cyfrif gyda'r e-bost hwn eisoes yn bodoli.",
    incorrectCredentials: "E-bost, rhif symudol neu gyfrinair anghywir.",
    passwordTooShort: "Rhaid i'r cyfrinair fod o leiaf 8 nod.",
    loginFailed: "Methodd y mewngofnodi. Rhowch gynnig arall.",
    registrationFailed: "Methu creu'r cyfrif. Rhowch gynnig arall.",
    adminRegistrationOnly: "Dim ond y super admin all greu cyfrifon gweinyddol ar ol mewngofnodi.",
  },
};

function rawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "string") return error.trim();
  return "";
}

export function localizeAuthErrorMessage(error: unknown, language: LanguageCode, fallback: string): string {
  const message = rawErrorMessage(error);
  if (!message) return fallback;

  const normalized = message.toLowerCase();
  const copy = AUTH_ERROR_MESSAGES[language] ?? AUTH_ERROR_MESSAGES.en;

  if (normalized.includes("valid email address or mobile number")) return copy.invalidContact;
  if (normalized.includes("invalid sign-in details")) return copy.invalidSignIn;
  if (normalized.includes("mobile number already exists")) return copy.mobileExists;
  if (normalized.includes("email already exists")) return copy.emailExists;
  if (normalized.includes("incorrect email, mobile number, or password")) return copy.incorrectCredentials;
  if (normalized.includes("password must be at least 8 characters")) return copy.passwordTooShort;
  if (normalized.includes("local api is not running")) return message;
  if (normalized.includes("api proxy failed")) return LOCAL_API_UNAVAILABLE_MESSAGE;
  if (normalized === "login failed") return copy.loginFailed;
  if (normalized === "registration failed" || normalized.startsWith("registration failed:")) {
    return copy.registrationFailed;
  }
  if (normalized.includes("admin accounts can only be created")) return copy.adminRegistrationOnly;

  return language === "en" ? message : fallback;
}
