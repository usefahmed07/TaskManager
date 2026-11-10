import type { Request, Response, NextFunction } from "express";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import mongoose from "mongoose";
import router from "./router/route.js";
import { status } from "./config/status.js";

const app = express();

const limiter = (limit: number) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, message: "TOO MANY REQUESTS. TRY AGAIN LATER." }
});

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));
if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    return res.status(connected ? 200 : 503).json({
        status: connected ? "ok" : "unavailable",
        db: connected ? "connected" : "disconnected",
        uptime: Math.round(process.uptime())
    });
});

if (process.env.NODE_ENV !== "test") {
    app.use("/api", limiter(300));
    app.use(["/api/user/login", "/api/user/register"], limiter(20));
}

app.use(router);

app.use((req, res) => {
    return res.status(status.NOT_FOUND).json({ status: status.NOT_FOUND, message: "ROUTE NOT FOUND." });
});

app.use((err: Error & { type?: string }, req: Request, res: Response, next: NextFunction) => {
    if (err.type === "entity.parse.failed") {
        return res.status(status.BAD_REQUEST).json({ status: status.BAD_REQUEST, message: "INVALID JSON BODY." });
    }
    console.error(err);
    return res.status(500).json({ status: 500, message: "INTERNAL SERVER ERROR." });
});

export default app;
