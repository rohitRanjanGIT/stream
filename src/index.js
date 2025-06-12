import express from 'express';
import {connectDB}  from './db/connectDB.js';
import { configDotenv } from 'dotenv';

configDotenv();

const app = express();
const PORT = process.env.PORT || 3000;

connectDB()
.then(() => {

    // Middleware to parse JSON bodies
    app.use(express.json());

    // Sample route
    app.get('/', (req, res) => {
        res.send('Hello World!');
    });

    // Start the server
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch((error) => {
    console.error('Failed to connect to the database:', error);
    process.exit(1); // Exit the process with failure
});