// Vercel catch-all function for the existing Express API.
// The Express app does not call app.listen when VERCEL=1.
export { default } from "../server/index.js";

export const config = {
  maxDuration: 60,
};
