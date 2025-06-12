import express from 'express';
import cors from 'cors';
import { configDotenv } from 'dotenv';
import cookieParser from 'cookie-parser';

configDotenv();

const app = express();

{ // Middleware configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json({
    limit: '50kb',
}));
app.use(express.urlencoded({}));
app.use(express.static('public'));
app.use(cookieParser());
}

export default app;