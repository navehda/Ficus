const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const app = express();
const port = 3000;
const dataPath = path.join(__dirname, 'data', 'users.json');
const cartFilePath = path.join(__dirname, 'data', 'cart.json');
const activityLogPath = path.join(__dirname, 'data', 'activity.json');
// const multer = require('multer');
// const upload = multer();


// Set up middleware
app.use(bodyParser.urlencoded({ extended: true })); // To parse URL-encoded data from forms
app.use(cookieParser()); // To parse cookies

function checkAuth(req, res, next) {
    console.log("Checking auth, username:", req.cookies.username); // Add this for debugging
    if (req.cookies.username) {
        next();
    } else {
        console.log("Redirecting to login because no username found in cookies.");
        res.redirect('/login');
    }
}

// Function to log user activity using async/await
async function logActivity(username, activityType) {
    try {
        let activities = [];

        // Check if the activity file exists and read the data
        if (fs.existsSync(activityLogPath)) {
            const data = await fs.promises.readFile(activityLogPath, 'utf8');
            activities = JSON.parse(data || '[]');
        }

        // Append the new activity
        activities.push({
            datetime: new Date().toISOString(),
            username: username,
            type: activityType
        });

        // Write updated activities back to the file
        await fs.promises.writeFile(activityLogPath, JSON.stringify(activities, null, 2), 'utf8');
        console.log(`Activity logged for ${username}: ${activityType}`);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

module.exports = logActivity;

// Protect routes
app.use('/cart', checkAuth);
app.use('/checkout', checkAuth);

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Use dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Routes for user registration and login
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Load existing users
    try {
        let users = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log('Existing users:', users);

        // Check if username is taken
        const existingUser = users.find(user => user.username === username);
        if (existingUser) {
            return res.render('register', { error: 'Username already taken' });
        }

        // Add new user
        users.push({ username, password, rememberMe: false });
        console.log('Updated users:', users);

        // Write updated users back to file
        fs.writeFileSync(dataPath, JSON.stringify(users, null, 2));
        console.log('User successfully registered:', username);

        res.redirect('/login');
    } catch (err) {
        console.error('Error reading or writing users.json:', err);
        res.status(500).send('An error occurred during registration.');
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/logout', (req, res) => {
    const username = req.cookies.username;  // Get the username from the cookies
    res.clearCookie('username');  // Clear the username cookie

    // Log the logout activity
    logActivity(username, 'logout');

    res.redirect('/login');  // Redirect to the login page
});

app.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;

    // Load existing users
    let users = JSON.parse(fs.readFileSync(dataPath));

    // Find user
    const user = users.find(user => user.username === username && user.password === password);
    if (!user) {
        return res.render('login', { error: 'Invalid username or password' });
    }

    // Log the login activity
    await logActivity(username, 'login');
    
    // Set cookie for session
    res.cookie('username', username, { maxAge: rememberMe ? 10 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000 }); // 10 days or 30 minutes
    res.redirect('/');
});

// Route to handle adding items to the cart
app.post('/cart/add', checkAuth, (req, res) => {
    const { productId, quantity } = req.body;
    const username = req.cookies.username;

    console.log(`Adding product ${productId} with quantity ${quantity} to ${username}'s cart`);

    // Read the cart file
    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading cart data:', err);
            return res.status(500).send('Error reading cart data');
        }

        let carts = {};
        if (data && data.trim().length > 0) { // Ensure data is not empty
            try {
                carts = JSON.parse(data); // Parse cart data if file is not empty
            } catch (parseError) {
                console.error('Error parsing cart data:', parseError);
                return res.status(500).send('Error parsing cart data');
            }
        }

        // Initialize the user's cart if it doesn't exist
        let userCart = carts[username] || [];

        // Check if the product already exists in the cart
        const productIndex = userCart.findIndex(item => item.productId == productId);

        if (productIndex > -1) {
            // Update quantity if it exists
            userCart[productIndex].quantity += parseInt(quantity, 10);
        } else {
            // Add new product with basic details
            const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'products.json')));
            const product = products.find(p => p.id == productId);

            if (product) {
                console.log("Matched Product:", product);
                userCart.push({
                    productId: product.id.toString(),
                    quantity: parseInt(quantity, 10),
                    name: product.name,
                    price: product.price,
                });
            } else {
                console.log("Product not found for productId:", productId);
                return res.status(500).send('Product not found');
            }
        }

        // Log the userCart to ensure the items are correct
        console.log(`Final user cart before saving: ${JSON.stringify(userCart, null, 2)}`);

        // Update the carts object with the user's updated cart
        // carts[username] = userCart;
        fs.writeFileSync(cartFilePath, JSON.stringify({ testUser: [{ productId: "1", quantity: 1 }] }, null, 2), 'utf8');

        // Write the cart back to the file
        try {
            const fileContent = JSON.stringify(carts, null, 2);  // Store the data being written
            console.log('Content to be written to file:', fileContent);  // Log the data that will be written
        
            fs.writeFileSync(cartFilePath, fileContent, 'utf8');  // Write to the file
            console.log(`Successfully saved cart data to file: ${cartFilePath}`);
        } catch (err) {
            console.error('Error saving cart data:', err);
            res.status(500).send('Error saving cart data');
        }
        });
        logActivity(username, 'add-to-cart');
        res.redirect('/cart');
});


// Route to display the cart
app.get('/cart', checkAuth, (req, res) => {
    const username = req.cookies.username;

    console.log("Displaying cart for:", username);

    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading cart data:', err);
            return res.status(500).send('Error reading cart data');
        }

        const carts = JSON.parse(data || '{}');
        const userCart = carts[username] || [];

        console.log("User cart contents:", userCart);

        res.render('cart', { cart: userCart });
    });
});

// Import and use routes
app.use('/', require('./routes/home'));
app.use('/contact', require('./routes/contact'));
app.use('/faqs', require('./routes/faqs'));
app.use('/login', require('./routes/login'));
app.use('/shop', require('./routes/shop'));
app.use('/single', require('./routes/single'));

// Routes for each EJS page
app.get('/', (req, res) => {
    const data = {
        title: 'Ficus - Sustainable Goods',
        storeName: 'Ficus Store',
        category: 'Sustainable and Green Products'
    };
    res.render('index', data); // Renders views/index.ejs with data
});

app.get('/search', (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';  // Safely check if query exists

    // Load the products data
    const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'products.json')));

    let filteredProducts;
    if (query) {
        // Filter products based on the search query
        filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(query) ||
            (product.category && product.category.toLowerCase().includes(query))
        );
    } else {
        // If no query, show all products
        filteredProducts = products;
    }

    res.render('shop', { products: filteredProducts, query: req.query.q || '' });  // Pass the original query to the view
});

app.get('/checkout', checkAuth, (req, res) => {
    const username = req.cookies.username;
    
    // Read the cart data
    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading cart data:', err);
            return res.status(500).send('Error reading cart data');
        }

        const carts = JSON.parse(data || '{}');
        const userCart = carts[username] || [];
        const cartTotal = userCart.reduce((total, item) => total + item.price * item.quantity, 0);

        res.render('checkout', { cart: userCart, cartTotal });
    });
});

app.post('/checkout', checkAuth, (req, res) => {
    const username = req.cookies.username;
    const { address, paymentMethod } = req.body;

    // Load the user's cart
    fs.readFile(cartFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading cart data:', err);
            return res.status(500).send('Error reading cart data');
        }

        const carts = JSON.parse(data || '{}');
        const userCart = carts[username] || [];

        // Calculate total
        const cartTotal = userCart.reduce((total, item) => total + item.price * item.quantity, 0);

        // Simulate saving the order (In a real app, save it to the database)
        const orderDetails = {
            username,
            address,
            paymentMethod,
            cart: userCart,
            total: cartTotal,
            date: new Date()
        };

        // Clear the user's cart after purchase
        delete carts[username];
        fs.writeFileSync(cartFilePath, JSON.stringify(carts, null, 2));

        // Redirect to Thank You page with order details
        res.render('thankyou', { orderDetails });
    });
});

app.get('/admin', async (req, res) => {
    try {
        // Read activity log
        const activityData = await fs.promises.readFile(activityLogPath, 'utf8');
        let activities = activityData && activityData.trim() ? JSON.parse(activityData) : [];

        // Read products
        const productData = await fs.promises.readFile(path.join(__dirname, 'data', 'products.json'), 'utf8');
        let products = productData && productData.trim() ? JSON.parse(productData) : [];

        // Render the admin template with activities and products
        res.render('admin', { activities, products });
    } catch (err) {
        console.error('Error reading activity log or products:', err);
        res.status(500).send('Error reading activity log or products');
    }
});


app.get('/admin/activity', async (req, res) => {
    const prefix = req.query.prefix || ''; // Get prefix filter if provided

    try {
        const data = await fs.promises.readFile(activityLogPath, 'utf8');
        let activities = data && data.trim() ? JSON.parse(data) : [];

        // Filter activities based on the username prefix
        if (prefix) {
            activities = activities.filter(activity => activity.username.startsWith(prefix));
        }

        res.json(activities); // Send filtered activities as JSON
    } catch (err) {
        console.error('Error reading activity log:', err);
        res.status(500).send('Error reading activity log');
    }
});

app.post('/admin/products/add', async (req, res) => {
    const { title, price, description, image } = req.body;

    try {
        // Read current products
        const data = await fs.promises.readFile(path.join(__dirname, 'data', 'products.json'), 'utf8');
        const products = data && data.trim() ? JSON.parse(data) : [];

        // Create a new product, using "name" as the key for the title
        const newProduct = {
            id: products.length ? products[products.length - 1].id + 1 : 1, // Auto-incrementing ID
            name: title, // Use "name" instead of "title"
            price: parseFloat(price),
            description,
            image
        };

        // Add the new product to the list
        products.push(newProduct);

        // Save the updated list
        await fs.promises.writeFile(path.join(__dirname, 'data', 'products.json'), JSON.stringify(products, null, 2), 'utf8');

        res.redirect('/admin');
    } catch (err) {
        console.error('Error adding product:', err);
        res.status(500).send('Error adding product');
    }
});

app.post('/admin/products/delete', async (req, res) => {
    const { productId } = req.body;

    try {
        // Read current products
        const data = await fs.promises.readFile(path.join(__dirname, 'data', 'products.json'), 'utf8');
        let products = data && data.trim() ? JSON.parse(data) : [];

        // Filter out the product to be deleted
        products = products.filter(product => product.id != productId);

        // Save the updated list
        await fs.promises.writeFile(path.join(__dirname, 'data', 'products.json'), JSON.stringify(products, null, 2), 'utf8');

        res.redirect('/admin');
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).send('Error deleting product');
    }
});


app.listen(port, () => {
    console.log(`Ficus server running on http://localhost:${port}`);
});