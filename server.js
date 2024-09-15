const https = require('https');
const http = require('http');
const fs = require('fs');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const app = express();
const port = 3000;
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

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

// Load SSL certificate and private key
const privateKey = fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem'), 'utf8');
const certificate = fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'), 'utf8');

// Create credentials object
const credentials = { key: privateKey, cert: certificate };

// Redirect HTTP to HTTPS
const httpApp = express();
httpApp.use((req, res) => {
    res.redirect(`https://${req.headers.host}${req.url}`);
});

const httpsServer = https.createServer(credentials, app);

// HTTPS server listens on port 443
httpsServer.listen(443, () => {
    console.log('Ficus HTTPS Server running on port 443');
});


// HTTP server listens on port 80
const httpServer = http.createServer(httpApp);
httpServer.listen(80, () => {
    console.log('Ficus HTTP Server running on port 80 (redirects to HTTPS)');
});

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true })); // To parse URL-encoded data from forms
app.use(cookieParser()); // To parse cookies
const helmet = require('helmet');
app.use(helmet()); // Automatically sets security headers

// Middleware to attach username globally to `res.locals`
app.use((req, res, next) => {
    res.locals.username = req.cookies.username || null; // Attach `username` to res.locals
    next();  // Move to the next middleware or route handler
});

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many requests, please try again in 15 minutes',
    standardHeaders: true, // Send rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter to login and checkout routes
app.use('/login', limiter);
app.use('/checkout', limiter);
app.use('/register', limiter);


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
    res.render('register', { errors: [] });  // Pass an empty errors array initially
});

app.post('/register', 
    limiter,  // Apply rate limiter to prevent excessive registration attempts
    [
        // Validate and sanitize inputs
        body('username')
            .trim()            // Remove extra spaces before/after the username
            .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscores, and hyphens')
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),
        body('password')
            .trim()            // Remove extra spaces
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),  // Validate password length
    ],
    async (req, res) => {
        const errors = validationResult(req);
        const { username, password } = req.body;

        // If there are validation errors, return them to the template
        if (!errors.isEmpty()) {
            return res.render('register', { 
                errors: errors.array(), 
                username // Pass the username back to pre-fill the form
            });
        }

        try {
            // Load existing users from persist.js
            let users = await getUsers();

            // Check if the username is already taken
            const existingUser = users.find(user => user.username === username);
            if (existingUser) {
                return res.render('register', { 
                    errors: [{ msg: 'Username already taken' }], 
                    username
                });
            }

            // Add new user
            users.push({ username, password });
            await saveUsers(users);

            // Redirect to login page after successful registration
            res.redirect('/login');
        } catch (err) {
            console.error('Error during registration:', err);
            res.status(500).send('An error occurred during registration.');
        }
    }
);

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
app.post('/login', 
    limiter,  // Apply rate limiter to the login route
    [
        // Validate and sanitize inputs
        body('username')
            .trim()            // Remove extra spaces before/after the username
            .escape(),          // Escape special characters (for security)
        body('password')
            .trim()            // Remove extra spaces
            .escape(),          // Escape special characters
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Return validation errors
            return res.status(400).json({ errors: errors.array() });
        }
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
        // When setting cookies, add flags for security
        res.cookie('username', username, { 
        maxAge: rememberMe ? 10 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000, // Expiry time
        httpOnly: true,   // Prevents client-side JavaScript from accessing the cookie
        secure: true, // Ensures the cookie is sent over HTTPS
        sameSite: 'Strict' // Prevents CSRF attacks
});
        
        // Redirect to homepage after login
        res.redirect('/');
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).send('An error occurred during login.');
    }
});

// Route to handle adding items to the cart
// Route to handle adding items to the cart
app.post('/cart/add', checkAuth, async (req, res) => {
    const { productId, quantity } = req.body;  // Assuming `productId` and `quantity` are sent from the form
    const username = req.cookies.username;

    try {
        // Load carts and products from persistence
        const carts = await getCarts();
        const products = await getProducts();

        // Find the product by productId
        const product = products.find(p => p.id == productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Initialize user's cart if it doesn't exist
        let userCart = carts[username] || [];

        // Check if the product is already in the cart
        const cartItemIndex = userCart.findIndex(item => item.productId == productId);

        if (cartItemIndex > -1) {
            // Update quantity if product already exists in cart
            userCart[cartItemIndex].quantity += parseInt(quantity, 10);
        } else {
            // Add new product to cart with all details
            userCart.push({
                productId: product.id,
                quantity: parseInt(quantity, 10),
                product: {  // Add full product details to the cart
                    id: product.id,
                    name: product.name,
                    imageUrl: product.imageUrl,  // Ensure this field exists in `products.json`
                    price: product.price
                }
            });
        }

        // Save the updated cart back to persistence
        carts[username] = userCart;
        await saveCarts(carts);

        // Redirect back to the cart page
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

        // Calculate the cart total
        const cartTotal = userCart.reduce((total, item) => {
            return total + item.product.price * item.quantity;
        }, 0);

        res.render('cart', { cart: userCart, cartTotal });
    } catch (err) {
        console.error('Error loading cart:', err);
        res.status(500).send('Error loading cart');
    }
});

app.post('/cart/update', checkAuth, async (req, res) => {
    const { productId, quantity } = req.body;  // Extract the product ID and quantity from the request body
    const username = req.cookies.username;  // Get the username from the cookies

    try {
        // Load the carts from persistence
        const carts = await getCarts();

        // Find the user's cart
        let userCart = carts[username] || [];

        // Find the item in the cart that matches the productId
        const itemIndex = userCart.findIndex(item => item.productId == productId);

        if (itemIndex > -1) {
            // Update the item's quantity
            userCart[itemIndex].quantity = parseInt(quantity, 10);

            // Remove the item if the quantity is 0
            if (userCart[itemIndex].quantity === 0) {
                userCart.splice(itemIndex, 1);
            }
        }

        // Save the updated cart back to persistence
        carts[username] = userCart;
        await saveCarts(carts);

        // Redirect back to the cart page after updating
        res.redirect('/cart');
    } catch (err) {
        console.error('Error updating cart:', err);
        res.status(500).send('Error updating cart');
    }
});

// Route to handle removing items from the cart
app.post('/cart/remove', checkAuth, async (req, res) => {
    const { productId } = req.body;  // Extract the product ID from the request body
    const username = req.cookies.username;  // Get the username from the cookies
    // Load the carts from persistence
    const carts = await getCarts();
    // Find the user's cart
    let userCart = carts[username] || [];
    // Find the item in the cart that matches the productId
    const itemIndex = userCart.findIndex(item => item.productId == productId);
    if (itemIndex > -1) {
        // Remove the item from the cart
        userCart.splice(itemIndex, 1);
    }
    // Save the updated cart back to persistence
    carts[username] = userCart;
    await saveCarts(carts);
    // Redirect back to the cart page after removing the item
    res.redirect('/cart');
});


// Import and use routes
app.use('/contact', require('./routes/contact'));
app.use('/faqs', require('./routes/faqs'));
app.use('/login', require('./routes/login'));
app.use('/wishlist', require('./routes/wishlist'));

// Route for the home page
app.get('/', (req, res) => {
    const data = {
        title: 'Ficus - Sustainable Goods',
        storeName: 'Ficus Store',
        category: 'Sustainable and Green Products',
        username: req.cookies.username
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
app.post('/checkout', checkAuth,
    [
        // Validation for address
        body('address')
            .notEmpty().withMessage('Address cannot be empty')
            .isLength({ min: 10 }).withMessage('Address must be at least 10 characters long'),
        // Validation for payment method
        body('paymentMethod')
            .isIn(['credit', 'paypal']).withMessage('Invalid payment method')
    ],
    async (req, res) => {
        const username = req.cookies.username;
        const { address, paymentMethod } = req.body;

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

    try {
        const carts = await getCarts();
        const userCart = carts[username] || [];
        const cartTotal = userCart.reduce((total, item) => total + item.price * item.quantity, 0);

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

        res.render('thankyou', { orderDetails });
    } catch (err) {
        console.error('Error during checkout:', err);
        res.status(500).send('Error during checkout');
    }
});

// Route to handle checkout form submission and display the Thank You page
app.post('/checkout/complete', checkAuth,
    [
        // Validation for address
        body('address')
            .notEmpty().withMessage('Address cannot be empty')
            .isLength({ min: 10 }).withMessage('Address must be at least 10 characters long'),
        // Validation for payment method
        body('paymentMethod')
            .isIn(['credit', 'paypal']).withMessage('Invalid payment method')
    ],
    async (req, res) => {
    const username = req.cookies.username;
    const { address, paymentMethod } = req.body;

    try {
        // Load the user's cart from persistence
        const carts = await getCarts();
        const userCart = carts[username] || [];

        // Calculate the total
        const cartTotal = userCart.reduce((total, item) => total + item.price * item.quantity, 0);

        // Create order details to display in the Thank You page
        const orderDetails = {
            username,
            address,
            paymentMethod,
            total: cartTotal
        };

        // Log the checkout activity
        await logActivity(username, 'checkout');

        // Clear the user's cart after purchase
        delete carts[username];
        await saveCarts(carts);

        // Render the Thank You page with the order details
        res.render('thankyou', { orderDetails });

    } catch (error) {
        console.error('Error processing checkout:', error);
        res.status(500).send('An error occurred during checkout.');
    }
});


// GET /admin route: Renders the admin panel with activities and products
app.get('/admin', async (req, res) => {
    try {
        // Read activity log
        const activities = await getActivities(); // Ensure getActivities fetches a proper array

        // Read products
        const products = await getProducts();

        // If activities is undefined or not an array, initialize it as an empty array
        if (!Array.isArray(activities)) {
            console.log('Activity log is empty or undefined, initializing an empty array.');
            activities = [];
        }

        // Reverse the order of activities to show the newest first
        activities.reverse();


        // Render the admin template with activities and products
        res.render('admin', { activities, products });
    } catch (err) {
        console.error('Error reading activity log or products:', err);
        res.status(500).send('Error reading activity log or products');
    }
});

// GET /admin/activity route: Fetches activities filtered by username prefix
app.get('/admin/activity', async (req, res) => {
    const prefix = req.query.prefix || ''; // Get prefix filter if provided

    try {
        let activities = await getActivities();

        // Ensure activities is a valid array
        if (!Array.isArray(activities)) {
            activities = [];
        }

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

// Route to render user profile page (GET)
app.get('/profile', checkAuth, async (req, res) => {
    const username = req.cookies.username;

    try {
        const users = await getUsers();
        const user = users.find(u => u.username === username);

        if (user) {
            res.render('user-profile', { user, success: null, error: null });
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).send('Error loading profile');
    }
});

// Route to handle profile update
app.post('/profile', 
    [
        // Validate and sanitize username
        body('newUsername')
            .trim()
            .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscores, and hyphens')
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long'),

        // Validate and sanitize new password
        body('newPassword')
            .trim()
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
        
        // Check if re-entered password matches
        body('reenterPassword')
            .custom((value, { req }) => {
                if (value !== req.body.newPassword) {
                    throw new Error('Passwords do not match');
                }
                return true;
            }),

        // Sanitize address
        body('newAddress').trim()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        const username = req.cookies.username;
        const { newUsername, newPassword, reenterPassword, newAddress } = req.body;

        if (!errors.isEmpty()) {
            return res.render('user-profile', { error: errors.array()[0].msg, success: null, user: { username: newUsername, address: newAddress } });
        }

        try {
            // Load users and check if the new username already exists
            const users = await getUsers();
            const existingUser = users.find(user => user.username === newUsername && user.username !== username);

            if (existingUser) {
                return res.render('user-profile', { error: 'Username already exists', success: null, user: { username: newUsername, address: newAddress } });
            }

            // Find the user based on the current username
            const user = users.find(user => user.username === username);
            if (user) {
                let passwordChanged = false;

                // Detect if password is changed by comparing old and new password
                if (newPassword && newPassword !== user.password) {
                    user.password = newPassword;  // In real-world apps, this should be hashed
                    passwordChanged = true;
                }

                // Update username and address
                user.username = newUsername;
                user.address = newAddress;

                // Save users back to persistence
                await saveUsers(users);

                // Log the password change if it was updated
                if (passwordChanged) {
                    console.log('Logging password change activity for:', username);
                    await logActivity(username, 'changed-password');
                }

                res.render('user-profile', { success: 'Profile updated successfully', error: null, user });
            } else {
                res.render('user-profile', { error: 'User not found', success: null, user: { username: newUsername, address: newAddress } });
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            res.status(500).send('Error updating profile');
        }
    }
);

// Route to display the wishlist page
app.get('/wishlist', checkAuth, async (req, res) => {
    const username = req.cookies.username;

    try {
        // Load wishlist from persistence (file or database)
        const wishlists = await getWishlists();
        const userWishlist = wishlists[username] || [];

        // Render the wishlist page with the user's wishlist
        res.render('wishlist', { wishlist: userWishlist });
    } catch (err) {
        console.error('Error loading wishlist:', err);
        res.status(500).send('Error loading wishlist');
    }
});

// Route to add a product to the wishlist
app.post('/wishlist/add', checkAuth, async (req, res) => {
    const { productId } = req.body; // Extract productId from form data
    const username = req.cookies.username; // Get logged-in username from cookies

    try {
        // Load existing wishlists and products
        const wishlists = await getWishlists();
        const products = await getProducts();

        // Check if product exists in the database
        const product = products.find(p => p.id == productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Initialize user's wishlist if it doesn't exist
        let userWishlist = wishlists[username] || [];

        // Add product to wishlist if it's not already there
        if (!userWishlist.some(item => item.id === productId)) {
            userWishlist.push(product);
            wishlists[username] = userWishlist;
            await saveWishlists(wishlists); // Save updated wishlist
            console.log('Wishlist saved successfully:', wishlists); // Log success
        }

        res.redirect('back');
    } catch (err) {
        console.error('Error adding to wishlist:', err);
        res.status(500).send('Error adding to wishlist');
    }
});

// Route to remove a product from the wishlist
app.post('/wishlist/remove', checkAuth, async (req, res) => {
    const { productId } = req.body;
    const username = req.cookies.username;

    try {
        // Load existing wishlists
        const wishlists = await getWishlists();

        // Initialize wishlist for the user if not present
        if (!wishlists[username]) {
            return res.redirect('/wishlist'); // If the user doesn't have a wishlist, redirect
        }

        // Remove the product from the user's wishlist
        wishlists[username] = wishlists[username].filter(item => item.id !== productId);

        // Save the updated wishlist
        await saveWishlists(wishlists);

        // Redirect back to the wishlist page
        res.redirect('/wishlist');
    } catch (err) {
        console.error('Error removing from wishlist:', err);
        res.status(500).send('Error removing from wishlist');
    }
});

// Route to llm generated code
app.get('/llm', (req, res) => {
    res.render('llm');
});


