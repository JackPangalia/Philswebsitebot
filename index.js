import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON body
app.use(express.json());

// POST /message route
app.post('/message', (req, res) => {
  res.json({ message: 'Hello World' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
