const express = require('express');
const router = express.Router();
const products = await getProducts();
const product = products.find(p => p.id == productId);
const {getCarts, saveCarts, getProducts} = require('../persist');


// Route to display the cart
router.get('/', async (req, res) => {
    const username = req.cookies.username;
    const carts = await getCarts();
    const userCart = carts[username] || [];

    const cartTotal = userCart.reduce((total, item) => total + item.product.price * item.quantity, 0);

    res.render('cart', { cart: userCart, cartTotal });
});

app.post('/cart/update', checkAuth, async (req, res) => {
    const { productId, quantity } = req.body;  // Get product ID and updated quantity from the form
    const username = req.cookies.username;

    try {
        // Load the carts from persistence
        const carts = await getCarts();

        // Find the user's cart
        let userCart = carts[username] || [];

        // Find the item in the cart to update
        const itemIndex = userCart.findIndex(item => item.productId == productId);

        if (itemIndex > -1) {
            // Update the item's quantity
            userCart[itemIndex].quantity = parseInt(quantity, 10);

            // Remove the item if quantity is 0
            if (userCart[itemIndex].quantity === 0) {
                userCart.splice(itemIndex, 1);
            }
        }

        // Save the updated cart back to persistence
        carts[username] = userCart;
        await saveCarts(carts);

        // Redirect back to the cart page
        res.redirect('/cart');
    } catch (err) {
        console.error('Error updating cart:', err);
        res.status(500).send('Error updating cart');
    }
});

module.exports = router;
