import { describe, expect, it } from "vitest";
import { localizeAuthErrorMessage } from "./authErrorLocalization";

describe("auth error localization", () => {
  it("localizes duplicate mobile errors to the selected language", () => {
    expect(
      localizeAuthErrorMessage(
        new Error("An account with this mobile number already exists."),
        "fr",
        "Une erreur est survenue. Reessayez.",
      ),
    ).toBe("Un compte avec ce numero mobile existe deja.");
  });

  it("localizes common backend auth errors", () => {
    expect(
      localizeAuthErrorMessage(
        new Error("Incorrect email, mobile number, or password."),
        "es",
        "Algo salio mal. Intentalo de nuevo.",
      ),
    ).toBe("Email, movil o contrasena incorrectos.");
    expect(
      localizeAuthErrorMessage(
        new Error("Please enter a valid email address or mobile number."),
        "de",
        "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
      ),
    ).toBe("Bitte geben Sie eine gueltige E-Mail-Adresse oder Mobilnummer ein.");
  });

  it("does not show unknown English backend text for non-English languages", () => {
    expect(localizeAuthErrorMessage(new Error("Unexpected backend detail."), "pt", "Algo correu mal.")).toBe(
      "Algo correu mal.",
    );
    expect(localizeAuthErrorMessage(new Error("Unexpected backend detail."), "en", "Something went wrong.")).toBe(
      "Unexpected backend detail.",
    );
  });

  it("hides technical account setup errors from users", () => {
    expect(
      localizeAuthErrorMessage(
        new Error("Database schema is out of date. Please run npm run db:auth, restart the app, and try again."),
        "en",
        "Something went wrong.",
      ),
    ).toBe("We could not create this account right now. Please try again later or contact VYVA support.");
    expect(
      localizeAuthErrorMessage(
        new Error("Account setup is not ready in this environment. Run npm run db:auth against the app database."),
        "es",
        "Algo salio mal.",
      ),
    ).toBe("No se pudo crear esta cuenta ahora. Intentalo mas tarde o contacta con soporte de VYVA.");
  });
});
