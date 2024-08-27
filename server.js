const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes for each HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/cart', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'cart.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

app.get('/faqs', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'faqs.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/shop', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'shop.html'));
});

app.get('/single', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'single.html'));
});

app.listen(port, () => {
    console.log(`Ficus server running on http://localhost:${port}`);
});
