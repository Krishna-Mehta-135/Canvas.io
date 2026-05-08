import express, { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";
import { errorHandler } from "./middlewares/error.middleware";
import { roomRouter } from "./routes/room.routes";
import { rateLimitMiddleware } from "./middlewares/rate-limit.middleware";
import { receiveAiResult } from "./controllers/room.controller";

const app: Express = express();

app.use(
  cors({
    origin: [
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
      "https://canvassync.tech",
      /\.vercel\.app$/,
    ],
    credentials: true,
  }),
);
app.use(rateLimitMiddleware);
app.use(express.json());
app.use(cookieParser());

// Internal endpoint for AI worker → HTTP backend callbacks.
// Not rate-limited; guarded by INTERNAL_SECRET header inside the controller.
app.post("/internal/ai/result", receiveAiResult);

//Routes
app.get("/", (req, res) => res.sendStatus(200));
app.get("/health", (req, res) => res.sendStatus(200));
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/room", roomRouter);

app.use(errorHandler);

export default app;
