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

app.listen(3001, () => {
    console.log("Server is running on port 3001");
});

export default app;
