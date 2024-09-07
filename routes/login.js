const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const usersFilePath = path.join(__dirname, '../data/users.json');

router.get('/', (req, res) => {
    res.render('login');
});

// POST route for login
router.post('/', (req, res) => {
    const { username, password, rememberMe } = req.body;
    const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));

    // Check if user exists and password matches
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Set cookie with username
        const options = {
            httpOnly: true,
            secure: false, // Set to true if using HTTPS
        };

        if (rememberMe) {
            options.maxAge = 10 * 24 * 60 * 60 * 1000; // 10 days
        } else {
            options.maxAge = 30 * 60 * 1000; // 30 minutes
        }

        res.cookie('username', username, options);
        res.redirect('/'); // Redirect to home or another protected route
    } else {
        res.redirect('/login?error=invalid'); // Redirect back to login with an error
    }
});

module.exports = router;
