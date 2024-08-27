const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes for each EJS page
app.get('/', (req, res) => {
    const data = {
        title: 'Ficus - Sustainable Goods',
        storeName: 'Ficus Store',
        category: 'Sustainable and Green Products'
    };
    res.render('index'); // Renders views/index.ejs
});

app.get('/cart', (req, res) => {
    res.render('cart'); // Renders views/cart.ejs
});

app.get('/contact', (req, res) => {
    res.render('contact'); // Renders views/contact.ejs
});

app.get('/faqs', (req, res) => {
    res.render('faqs'); // Renders views/faqs.ejs
});

app.get('/login', (req, res) => {
    res.render('login'); // Renders views/login.ejs
});

app.get('/shop', (req, res) => {
    res.render('shop'); // Renders views/shop.ejs
});

app.get('/single', (req, res) => {
    res.render('single'); // Renders views/single.ejs
});

app.listen(port, () => {
    console.log(`Ficus server running on http://localhost:${port}`);
});
