// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    console.log('Incoming username:', username);
    console.log('Incoming password:', password);
    const trimmedPassword = password.trim();
    

    const user = await User.findOne({ username });
    const name = await user.name;
    console.log('Fetched user:', user);
    if (!user) {
        return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(trimmedPassword, user.password);
    console.log('Password match:', isMatch);
    if (!isMatch) {
        return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, 'vUr82BUkC6m1vagUXqDpypBh+wNuZYhISK+5s9f2HVEwjzk68k0kBCUHDZLbafvU', { expiresIn: '1h' });

    res.json({ success: true, token, name });
});

module.exports = router;
