import { createApp, initServerContext } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT || 3001);
await initServerContext();

app.listen(port, () => {
  console.log("🎓 Scuola Interattiva - Server avviato");
  console.log(`📍 http://localhost:${port}`);
  console.log(`🔗 API: http://localhost:${port}/api`);
});
