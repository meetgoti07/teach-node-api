const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/students', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const db = mongoose.connection;

db.once('open', () => {
    console.log('Connected to the database');
}).on('error', (error) => {
    console.log('Error:', error);
});

// User Schema and Model
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
});

userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

// Seed the Data
const usersToSeed = [
    { username: '22BCE100', password: '123' },
    { username: '22BCE141', password: '123' },
    { username: '22BCE001', password: '123' },
    // ... Add as many users as you need
];

// Function to seed users
async function seedUsers() {
    try {
        for (let userData of usersToSeed) {
            const user = new User(userData);
            await user.save();
            console.log(`Saved user ${user.username}`);
        }
    } catch (error) {
        console.error('Error seeding users:', error);
    } finally {
        mongoose.connection.close();
    }
}

seedUsers();
