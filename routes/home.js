const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const data = {
        title: 'Ficus - Sustainable Goods',
        storeName: 'Ficus Store',
        category: 'Sustainable and Green Products'
    };
    res.render('index', data); // Renders views/index.ejs with data
});

module.exports = router;
