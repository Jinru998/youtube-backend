import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import videoRoutes from './routes/videos';
import cors from 'cors'; // Import the CORS package

const app = express();
const port = 3000;

// Middleware setup
app.use(bodyParser.json());
app.use(cors()); // Use CORS middleware for all routes

// Use the video routes
app.use('/videos', videoRoutes);

app.get('/', (req: Request, res: Response) => {
    res.send('YouTube backend is running!');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});