const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const app = express();
const port = 3000;
const { getUsers, saveUsers } = require('./persist');
const { getUsers, logActivity } = require('./persist');
const { getCarts, saveCarts, getProducts, logActivity } = require('./persist');
const { getProducts } = require('./persist');
const { getCarts, saveCarts, logActivity } = require('./persist');


const {
    getUsers,
    saveUsers,
    getCarts,
    saveCarts,
    logActivity,
    getProducts,     // For managing products
    saveProducts,    // To save new or modified products
    getActivities    // If needed for admin activities viewing
} = require('./persist');

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true })); // To parse URL-encoded data from forms
app.use(cookieParser()); // To parse cookies

// Auth middleware to protect routes
function checkAuth(req, res, next) {
    console.log("Checking auth, username:", req.cookies.username);
    if (req.cookies.username) {
        next();
    } else {
        console.log("Redirecting to login because no username found in cookies.");
        res.redirect('/login');
    }
}

// Log user activity using the imported logActivity function
async function logUserActivity(req, res, next, activityType) {
    try {
        const username = req.cookies.username;
        if (username) {
            await logActivity(username, activityType);
            console.log(`Activity logged for ${username}: ${activityType}`);
        }
    } catch (error) {
        console.error('Error logging activity:', error);
    }
    next();
}

// Protect routes
app.use('/cart', checkAuth);
app.use('/checkout', checkAuth);


// EJS template setup
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

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Load existing users using the function from persist.js
        let users = await getUsers();  
        console.log('Existing users:', users);

        // Check if username is taken
        const existingUser = users.find(user => user.username === username);
        if (existingUser) {
            return res.render('register', { error: 'Username already taken' });
        }

        // Add new user
        users.push({ username, password, rememberMe: false });
        console.log('Updated users:', users);

        // Save updated users back to file using persist.js
        await saveUsers(users);
        console.log('User successfully registered:', username);

        res.redirect('/login');
    } catch (err) {
        console.error('Error during registration:', err);
        res.status(500).send('An error occurred during registration.');
    }
});

// Import necessary functions from persist.js
const { getUsers, logActivity } = require('./persist');

// Route to display login page
app.get('/login', (req, res) => {
    res.render('login');
});

// Route to handle logout
app.get('/logout', async (req, res) => {
    const username = req.cookies.username;  // Get the username from the cookies

    // Clear the username cookie
    res.clearCookie('username');

    // Log the logout activity using persist.js
    await logActivity(username, 'logout');

    // Redirect to login page
    res.redirect('/login');
});

// Route to handle login
app.post('/login', async (req, res) => {
    const { username, password, rememberMe } = req.body;

    try {
        // Load existing users from persist.js
        let users = await getUsers();

        // Find user in the list of users
        const user = users.find(user => user.username === username && user.password === password);
        if (!user) {
            return res.render('login', { error: 'Invalid username or password' });
        }

        // Log the login activity using persist.js
        await logActivity(username, 'login');
        
        // Set session cookie for the user (10 days if "remember me" is checked, 30 minutes otherwise)
        res.cookie('username', username, { maxAge: rememberMe ? 10 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000 });
        
        // Redirect to homepage after login
        res.redirect('/');
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).send('An error occurred during login.');
    }
});

// Route to handle adding items to the cart
app.post('/cart/add', checkAuth, async (req, res) => {
    const { productId, quantity } = req.body;
    const username = req.cookies.username;

    console.log(`Adding product ${productId} with quantity ${quantity} to ${username}'s cart`);

    try {
        // Load carts and products from persist.js
        const carts = await getCarts();
        const products = await getProducts();

        // Initialize the user's cart if it doesn't exist
        let userCart = carts[username] || [];

        // Check if the product already exists in the cart
        const productIndex = userCart.findIndex(item => item.productId == productId);

        const product = products.find(p => p.id == productId);
        if (!product) {
            console.log("Product not found for productId:", productId);
            return res.status(500).send('Product not found');
        }

        if (productIndex > -1) {
            // Update quantity if it exists
            userCart[productIndex].quantity += parseInt(quantity, 10);
        } else {
            // Add new product to cart
            userCart.push({
                productId: product.id.toString(),
                quantity: parseInt(quantity, 10),
                name: product.name,
                price: product.price,
            });
        }

        // Save the updated cart
        carts[username] = userCart;
        await saveCarts(carts);

        // Log the add-to-cart activity
        await logActivity(username, 'add-to-cart');

        res.redirect('/cart');
    } catch (err) {
        console.error('Error adding to cart:', err);
        res.status(500).send('Error adding to cart');
    }
});

// Route to display the cart
app.get('/cart', checkAuth, async (req, res) => {
    const username = req.cookies.username;

    console.log("Displaying cart for:", username);

    try {
        // Load carts from persist.js
        const carts = await getCarts();

        // Get the user's cart
        const userCart = carts[username] || [];

        console.log("User cart contents:", userCart);

        res.render('cart', { cart: userCart });
    } catch (err) {
        console.error('Error loading cart:', err);
        res.status(500).send('Error loading cart');
    }
});

// Import and use routes
app.use('/contact', require('./routes/contact'));
app.use('/faqs', require('./routes/faqs'));
app.use('/login', require('./routes/login'));

// Route for the home page
app.get('/', (req, res) => {
    const data = {
        title: 'Ficus - Sustainable Goods',
        storeName: 'Ficus Store',
        category: 'Sustainable and Green Products'
    };
    res.render('index', data); // Renders views/index.ejs with data
});

// Route for the shop page, which lists products
app.get('/shop', async (req, res) => {
    try {
        // Load products from persistence
        const products = await getProducts();

        // Pass products data to the view
        res.render('shop', { products });
    } catch (err) {
        console.error('Error loading products:', err);
        res.status(500).send('Error loading products');
    }
});

// Route for individual product details
app.get('/single/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        // Load products from persistence
        const products = await getProducts();

        // Find the specific product
        const product = products.find(p => p.id == productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Pass product data to the view
        res.render('single', { product });
    } catch (err) {
        console.error('Error loading product:', err);
        res.status(500).send('Error loading product');
    }
});

app.get('/search', async (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';  // Safely check if query exists

    try {
        // Load the products data from persistence
        const products = await getProducts();

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

        // Render the shop view with the filtered products and query
        res.render('shop', { products: filteredProducts, query: req.query.q || '' });

    } catch (err) {
        console.error('Error loading products for search:', err);
        res.status(500).send('Error loading products for search');
    }
});

// GET /checkout route: Displays the checkout page
app.get('/checkout', checkAuth, async (req, res) => {
    const username = req.cookies.username;

    try {
        // Load the user's cart from persistence
        const carts = await getCarts();
        const userCart = carts[username] || [];
        const cartTotal = userCart.reduce((total, item) => total + item.price * item.quantity, 0);

        // Render the checkout page with the user's cart and total amount
        res.render('checkout', { cart: userCart, cartTotal });

    } catch (err) {
        console.error('Error loading cart data for checkout:', err);
        res.status(500).send('Error loading cart data for checkout');
    }
});

// POST /checkout route: Handles the checkout process
app.post('/checkout', checkAuth, async (req, res) => {
    const username = req.cookies.username;
    const { address, paymentMethod } = req.body;

    try {
        // Load the user's cart from persistence
        const carts = await getCarts();
        const userCart = carts[username] || [];

        // Calculate the total amount for the cart
        const cartTotal = userCart.reduce((total, item) => total + item.price * item.quantity, 0);

        // Simulate saving the order details (you can extend this to save in a database or file)
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
        await saveCarts(carts);

        // Log the checkout activity
        await logActivity(username, 'checkout');

        // Redirect to the Thank You page with the order details
        res.render('thankyou', { orderDetails });

    } catch (err) {
        console.error('Error processing checkout:', err);
        res.status(500).send('Error processing checkout');
    }
});

// Import necessary functions from persist.js
const { getProducts, saveProducts, logActivity } = require('./persist');

// GET /admin route: Renders the admin panel with activities and products
app.get('/admin', async (req, res) => {
    try {
        // Load activity log and products from persistence
        const activities = await logActivity();
        const products = await getProducts();

        // Render the admin panel template with activities and products
        res.render('admin', { activities, products });
    } catch (err) {
        console.error('Error loading activity log or products:', err);
        res.status(500).send('Error loading activity log or products');
    }
});

// GET /admin/activity route: Fetches activities filtered by username prefix
app.get('/admin/activity', async (req, res) => {
    const prefix = req.query.prefix || ''; // Get prefix filter if provided

    try {
        const activities = await logActivity();

        // Filter activities based on the username prefix
        const filteredActivities = activities.filter(activity =>
            activity.username.startsWith(prefix)
        );

        // Send filtered activities as JSON
        res.json(filteredActivities);
    } catch (err) {
        console.error('Error loading activity log:', err);
        res.status(500).send('Error loading activity log');
    }
});

// POST /admin/products/add route: Adds a new product
app.post('/admin/products/add', async (req, res) => {
    const { title, price, description, image } = req.body;

    try {
        // Load current products
        const products = await getProducts();

        // Create a new product
        const newProduct = {
            id: products.length ? products[products.length - 1].id + 1 : 1, // Auto-incrementing ID
            name: title,
            price: parseFloat(price),
            description,
            image
        };

        // Add the new product to the list
        products.push(newProduct);

        // Save the updated products list
        await saveProducts(products);

        // Redirect back to the admin panel
        res.redirect('/admin');
    } catch (err) {
        console.error('Error adding product:', err);
        res.status(500).send('Error adding product');
    }
});

// POST /admin/products/delete route: Deletes a product
app.post('/admin/products/delete', async (req, res) => {
    const { productId } = req.body;

    try {
        // Load current products
        const products = await getProducts();

        // Filter out the product to be deleted
        const updatedProducts = products.filter(product => product.id != productId);

        // Save the updated products list
        await saveProducts(updatedProducts);

        // Redirect back to the admin panel
        res.redirect('/admin');
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).send('Error deleting product');
    }
});

app.listen(port, () => {
    console.log(`Ficus server running on http://localhost:${port}`);
});