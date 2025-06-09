const express = require('express');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Простой роут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Simple server running on http://localhost:${PORT}`);
});