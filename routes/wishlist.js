const express = require('express');
const router = express.Router();
const { getWishlists, saveWishlists, getProducts } = require('../persist');

// Add item to wishlist
router.post('/add', async (req, res) => {
    const username = req.cookies.username;
    const productId = req.body.productId;
    
    console.log("Adding to wishlist - Username:", username, "Product ID:", productId);

    try {
        const wishlists = await getWishlists();
        const products = await getProducts();
        const product = products.find(p => p.id == productId);
        
        if (!product) {
            console.error("Product not found");
            return res.status(404).send('Product not found');
        }

        if (!wishlists[username]) {
            wishlists[username] = [];
        }

        if (!wishlists[username].some(item => item.productId == productId)) {
            wishlists[username].push(product);
            await saveWishlists(wishlists);
            console.log("Product added to wishlist:", product.name);
        }

        res.redirect('/wishlist');
    } catch (err) {
        console.error('Error adding to wishlist:', err);
        res.status(500).send('Error adding to wishlist');
    }
});

// View wishlist
router.get('/', async (req, res) => {
    const username = req.cookies.username;

    try {
        const wishlists = await getWishlists();
        const userWishlist = wishlists[username] || [];

        res.render('wishlist', { wishlist: userWishlist });
    } catch (err) {
        console.error('Error loading wishlist:', err);
        res.status(500).send('Error loading wishlist');
    }
});

module.exports = router;
