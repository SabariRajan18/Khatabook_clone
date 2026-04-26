import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './db/index.js';
import route from './routers/index.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 3000;

app.use('/api', route);
connectDB();

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});