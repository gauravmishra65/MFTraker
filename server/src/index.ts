import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimit";

import authRouter from "./routes/auth";
import stocksRouter from "./routes/stocks";
import mfRouter from "./routes/mf";
import portfolioRouter from "./routes/portfolio";
import watchlistRouter from "./routes/watchlist";
import alertsRouter from "./routes/alerts";
import marketRouter from "./routes/market";
import userRouter from "./routes/user";
import { attachPriceStream } from "./ws/priceStream";
import { openapi } from "./swagger";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api", apiLimiter);
app.use("/api/auth", authRouter);
app.use("/api/stocks", stocksRouter);
app.use("/api/mf", mfRouter);
app.use("/api/portfolio", portfolioRouter);
app.use("/api/watchlists", watchlistRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/market", marketRouter);
app.use("/api/user", userRouter);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
attachPriceStream(server);

server.listen(env.PORT, () => {
  logger.info(`API ready on http://localhost:${env.PORT}`);
  logger.info(`Swagger UI on http://localhost:${env.PORT}/api/docs`);
});
