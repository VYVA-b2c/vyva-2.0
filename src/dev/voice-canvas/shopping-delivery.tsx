import { useCallback, useState } from "react";
import {
  ShoppingVoiceCanvas,
  type ShoppingCanvasState,
} from "../../components/voice-canvas";
import {
  SHOPPING_CANVAS_COMMANDS,
  SHOPPING_CANVAS_COPY,
} from "../../pages/conciergeShoppingCanvasCopy";
import "./gallery.css";
import "./integration.css";

const review: ShoppingCanvasState = {
  step: "review",
  requestId: 0,
  revision: 0,
  draft: {
    retailerId: "market",
    retailerName: "Mercado del Barrio",
    items: [
      { id: "1", name: "Leche semidesnatada", quantity: "2 botellas de 1 litro" },
      { id: "2", name: "Pan integral", quantity: "1 barra" },
      { id: "3", name: "Detergente sin perfume", quantity: "1 envase" },
    ],
    itemName: "",
    itemQuantity: "",
    fulfillment: "delivery",
    locationId: "home",
    location: "Calle Mayor 14, Madrid",
    preferredTime: "Martes, de 10:00 a 12:00",
    substitutions: "ask",
    estimateStatus: "provided",
    estimatedCost: "42-48 €",
    fees: "Entrega 3,50 €",
    availability: "unverified",
  },
};

const sanitizedReview: ShoppingCanvasState = {
  step: "review",
  requestId: 0,
  revision: 0,
  draft: {
    retailerId: "market",
    retailerName: "Saved source",
    items: [
      { id: "1", name: "Prepared line A", quantity: "Quantity hidden" },
      { id: "2", name: "Prepared line B", quantity: "Quantity hidden" },
      { id: "3", name: "Prepared line C", quantity: "Quantity hidden" },
    ],
    itemName: "",
    itemQuantity: "",
    fulfillment: "delivery",
    locationId: "home",
    location: "Saved delivery option",
    preferredTime: "Selected delivery window",
    substitutions: "ask",
    estimateStatus: "unverified",
    estimatedCost: "",
    fees: "",
    availability: "unverified",
  },
};

export default function ShoppingDeliveryGallery() {
  const [mode, setMode] = useState<"review" | "interactive" | "changed" | "blocked">(
    "review",
  );
  const [key, setKey] = useState(0);
  const params = new URLSearchParams(location.search);
  const viewport = params.get("viewport");
  const evidenceSafe = params.get("evidence") === "sanitized";
  const width = viewport === "mobile" ? 390 : viewport === "tablet" ? 768 : undefined;
  const select = (next: typeof mode) => {
    setMode(next);
    setKey((value) => value + 1);
  };
  const confirm = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (mode === "blocked") {
      throw new Error(
        "La tienda no está disponible ahora. Revisa los datos e inténtalo de nuevo.",
      );
    }
    if (mode === "changed") {
      return {
        outcome: "changed" as const,
        message: "El comercio ha actualizado el coste. Revisa los cambios y confirma de nuevo.",
        changes: {
          estimatedCost: "46-52 €",
          fees: "Entrega 4,50 €",
          estimateStatus: "provided" as const,
        },
      };
    }
    return { outcome: "pending" as const, reference: "VYVA-SHOP-2486" };
  }, [mode]);

  return (
    <main
      className={`vc-gallery vc-integration-gallery ${
        viewport === "mobile" ? "vc-mobile-preview" : ""
      }`}
      style={width ? { width, maxWidth: "100%", margin: "0 auto" } : undefined}
    >
      <header>
        <p>VYVA · Shopping &amp; Delivery Canvas</p>
        <h1>Compra cotidiana, preparada con calma</h1>
        <span>Ningún pedido, pago o dirección compartida antes de confirmar</span>
      </header>
      <div className="vc-demo-toolbar">
        <button onClick={() => select("review")}>Revisión</button>
        <button onClick={() => select("interactive")}>Flujo completo</button>
        <button onClick={() => select("changed")}>Precio actualizado</button>
        <button onClick={() => select("blocked")}>Bloqueado</button>
      </div>
      <div className="vc-gallery-stage">
        <ShoppingVoiceCanvas
          key={key}
          copy={SHOPPING_CANVAS_COPY.es}
          voiceCommands={SHOPPING_CANVAS_COMMANDS.es}
          retailers={
            evidenceSafe
              ? [
                  {
                    id: "market",
                    label: "Fuente guardada",
                    description: "Etiqueta de demostración",
                  },
                  {
                    id: "long",
                    label: "Fuente guardada con una etiqueta traducida especialmente larga",
                    description: "Etiqueta de demostración",
                  },
                ]
              : [
                  {
                    id: "market",
                    label: "Mercado del Barrio",
                    description: "Guardado en tu perfil",
                  },
                  {
                    id: "long",
                    label: "Supermercado Cooperativo de Productos Locales y Entrega Accesible",
                    description: "Nombre traducido largo",
                  },
                ]
          }
          addresses={
            evidenceSafe
              ? [
                  {
                    id: "home",
                    label: "Opción guardada",
                    address: "Opción de entrega guardada",
                  },
                ]
              : [{ id: "home", label: "Casa", address: "Calle Mayor 14, Madrid" }]
          }
          initialState={mode === "interactive" ? undefined : evidenceSafe ? sanitizedReview : review}
          onConfirm={confirm}
          storageKey={`shopping-gallery-${key}-${evidenceSafe}`}
        />
      </div>
    </main>
  );
}
