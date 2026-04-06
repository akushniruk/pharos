import "./styles/docs.css";
import { mountApp } from "./docs/app.js";
import { mountNotificationHost } from "./notifications/ui.js";

const app = document.getElementById("app");
if (app) {
  mountNotificationHost();
  mountApp(app);
  app.setAttribute("data-ready", "true");
}
