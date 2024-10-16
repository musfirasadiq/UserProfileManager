// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const flash = require('express-flash');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer'); // Import multer for file uploads
const path = require('path');
const User = require('./models/User'); // Import the User model
const fs = require('fs');

const app = express();
const PORT = 4000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/your_database_name')
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('Could not connect to MongoDB', err);
    });

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: 'your_secret_key', // Change to a secure random value in production
    resave: false,
    saveUninitialized: true
}));
app.use(flash());

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, `${req.session.userId}-${Date.now()}-${file.originalname}`); // Unique filename
    }
});
const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
    res.render('home');
});

// Other routes...

// Update photo route
// Upload photo route
app.post('/upload', upload.single('profilePhoto'), async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        // Check if the file is uploaded
        if (!req.file) {
            req.flash('error', 'No file uploaded. Please try again.');
            return res.redirect('/profile');
        }

        // Find the user and update the profile photo
        const user = await User.findById(req.session.userId);

        // If the user has an existing photo, delete it
        if (user.profilePhoto && user.profilePhoto !== '/uploads/default.jpg') {
            const oldPhotoPath = path.join(__dirname, user.profilePhoto);
            fs.unlink(oldPhotoPath, (err) => {
                if (err) console.error('Failed to delete old photo:', err);
            });
        }

        // Update user with the new photo path
        user.profilePhoto = `/uploads/${req.file.filename}`;
        await user.save();

        req.flash('success', 'Profile photo updated successfully!');
        console.log(`Uploaded file: ${JSON.stringify(req.file)}`);
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to upload photo. Please try again.');
        res.redirect('/profile');
    }
});
// Other routes...

// Profile route
app.get('/profile', async (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect('/login');
        }

        res.render('profile', { user });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to load profile. Please try again.');
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    const loginError = req.flash('loginError');
    const registrationError = req.flash('registrationError');
    res.render('login_register', { 
        loginError: loginError.length > 0 ? loginError[0] : null,
        registrationError: registrationError.length > 0 ? registrationError[0] : null 
    });
});

// Example POST route for login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            req.flash('loginError', 'Invalid username or password');
            return res.redirect('/login');
        }

        req.session.userId = user._id; // Store user ID in session
        res.redirect('/profile'); // Redirect to profile after successful login
    } catch (error) {
        console.error(error);
        req.flash('loginError', 'An error occurred during login');
        res.redirect('/login');
    }
});
// Example POST route for registration
app.post('/register', async (req, res) => {
    const { name, email, username, password } = req.body;

    try {
        // Check if the username or email already exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            req.flash('registrationError', 'Username or email already exists');
            return res.redirect('/login'); // Redirect to login/register page with error
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create and save the new user
        const newUser = new User({
            name,
            email,
            username,
            password: hashedPassword,
            profilePhoto: '/uploads/default.jpg' // Set default photo
        });
        await newUser.save();

        // Store user ID in session
        req.session.userId = newUser._id;

        req.flash('success', 'Registration successful! Welcome to your profile.');
        res.redirect('/profile'); // Redirect to profile after successful registration
    } catch (error) {
        console.error(error);
        req.flash('registrationError', 'An error occurred during registration. Please try again.');
        res.redirect('/login'); // Redirect back to login/register page on error
    }
});


app.post('/delete-photo', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(req.session.userId);
        
        // Delete the current profile photo if it exists and is not the default
        if (user.profilePhoto && user.profilePhoto !== '/uploads/default.jpg') {
            const photoPath = path.join(__dirname, user.profilePhoto);
            fs.unlink(photoPath, (err) => {
                if (err) console.error('Failed to delete photo:', err);
            });
        }

        // Set the profile photo to default
        user.profilePhoto = '/uploads/default.jpg';
        await user.save();

        req.flash('success', 'Profile photo deleted successfully!');
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to delete photo. Please try again.');
        res.redirect('/profile');
    }
});

// Contact route
app.get('/contact', (req, res) => {
    res.render('contact'); // Ensure you have a contact.ejs view file
});
app.get('/register', (req, res) => {
    res.render('login_register', { registrationError: null });
});





// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.redirect('/profile'); // Redirect to profile if an error occurs
        }
        res.redirect('/login'); // Redirect to login after successful logout
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
