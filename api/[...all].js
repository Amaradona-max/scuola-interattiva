import { createApp, initServerContext } from "../server/app.js";

const app = createApp();
let readyPromise;

export default async function handler(req, res) {
  if (!readyPromise) {
    readyPromise = initServerContext();
  }
  await readyPromise;
  return app(req, res);
}
