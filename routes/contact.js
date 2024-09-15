const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Create a transporter object using SMTP (e.g., Gmail SMTP)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'ficus.ecostore@gmail.com',
        pass: 'ficus.store20'   
    }
});

router.post('/submit', (req, res) => {
    const { name, email, message } = req.body;

    // Email options
    const mailOptions = {
        from: email, // Sender address (the person who submitted the form)
        to: 'naveh.dayan@post.runi.ac.il', // Receiver address (your email where messages should be sent)
        subject: `Ficus - Form Submission from ${name}`,
        text: `You received a new message from ${name} (${email}):\n\n${message}`
    };

    // Send email
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
            console.error('Error sending email:', err);
            // Pass error to the template
            return res.render('contact', { error: 'An error occurred while sending the message. Please try again.', success: null });
        }
        console.log('Email sent:', info.response);
        // Pass success message to the template
        return res.render('contact', { success: 'Your message has been sent successfully!', error: null });
    });
});

// Render the contact page
router.get('/', (req, res) => {
    // Ensure success and error variables are defined, even if they're null
    res.render('contact', { success: null, error: null });
});

module.exports = router;
