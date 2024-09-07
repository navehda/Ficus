const express = require('express');
const router = express.Router();

// Cart route
router.get('/', (req, res) => {
    // Assuming that cart items are stored in session or a similar mechanism
    const cartItems = req.session.cart || [];
    
    res.render('cart', { cartItems });
});

module.exports = router;
