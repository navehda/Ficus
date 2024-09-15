const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Route for the shop page
router.get('/', (req, res) => {
    // Read the products from the JSON file
    const productsFilePath = path.join(__dirname, '../data', 'products.json');
    
    fs.readFile(productsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading products file:', err);
            return res.status(500).send('Server error');
        }

        const products = JSON.parse(data);
        res.render('shop', { products: products });
    });
});

// Route for individual product pages
router.get('/single/:id', (req, res) => {
    const productId = req.params.id; // Get the product ID from the URL
    const productsFilePath = path.join(__dirname, '../data', 'products.json');
    
    fs.readFile(productsFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading products file:', err);
            return res.status(500).send('Server error');
        }

        const products = JSON.parse(data);
        const product = products.find(p => p.id == productId); // Find the product by ID

        if (!product) {
            return res.status(404).send('Product not found');
        }

        res.render('single', { product: product }); // Render the single product page
    });
});

// route for filtering products by category
jQuery(document).ready(function($) {
    var $container = jQuery('#shop');

    $container.isotope({
        itemSelector: '.product',
        layoutMode: 'fitRows'
    });

    jQuery('.shop-filter a').click(function() {
        var filterValue = jQuery(this).attr('data-filter');
        $container.isotope({ filter: filterValue });
        return false;
    });
});


module.exports = router;
