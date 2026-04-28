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
    origin: (origin, callback) => {
      // Allow same-machine browser clients across local hostnames and ports.
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOriginPattern =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
      if (allowedOriginPattern.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
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
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/room", roomRouter);

app.use(errorHandler);

export default app;
