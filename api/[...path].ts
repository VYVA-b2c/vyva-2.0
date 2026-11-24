// Vercel catch-all function for the existing Express API. Set the explicit
// serverless guard before importing the Express app so it never calls listen(),
// even if a deployment has system environment variables disabled.
type VercelRequestLike = Parameters<import("express").Express>[0];
type VercelResponseLike = Parameters<import("express").Express>[1];

let appPromise: Promise<import("express").Express> | undefined;

export default async function handler(req: VercelRequestLike, res: VercelResponseLike) {
  process.env.VYVA_SERVERLESS = "1";
  appPromise ??= import("../server/index.js").then((module) => module.default);
  const app = await appPromise;
  return app(req, res);
}

export const config = {
  maxDuration: 300,
};
