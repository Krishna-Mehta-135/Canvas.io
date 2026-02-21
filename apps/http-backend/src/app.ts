import express, { Express } from "express";
import cookieParser from "cookie-parser";
import {authRouter} from "./routes/auth.routes";
import {errorHandler} from "./middlewares/error.middleware";

const app: Express = express();

app.use(express.json());
app.use(cookieParser());

//Routes
app.use("/api/v1/auth", authRouter);

app.use(errorHandler);

export default app;
