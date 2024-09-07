const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Route to display a single product
router.get('/:id', (req, res) => {
    const productId = parseInt(req.params.id, 10); // Convert to integer
    const productsFilePath = path.join(__dirname, '../data', 'products.json');  // Path to the products JSON file

    fs.readFile(productsFilePath, 'utf8', (err, data) => {  // Read the JSON file
        if (err) {
            console.error('Error reading products file:', err);
            return res.status(500).send('Server error');  // Handle file read errors
        }

        const products = JSON.parse(data);  // Parse the JSON data
        console.log('Requested Product ID:', productId);  // Log the requested product ID
        console.log('Products:', products);  // Log all products

        const product = products.find(p => p.id === productId); // Match with integer IDs
        console.log('Matched Product:', product);  // Log the matched product

        if (!product) {
            return res.status(404).send('Product not found');  // Handle case where product is not found
        }

        res.render('single', { product: product });  // Render the single.ejs template with the product data
    });
});

module.exports = router;
