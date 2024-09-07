const express = require('express');
const router = express.Router();

router.get('/faqs', (req, res) => {
    res.render('faqs');
});

module.exports = router;
