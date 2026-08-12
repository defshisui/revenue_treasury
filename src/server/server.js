import express from "express";
import bcrypt from "bcryptjs";

const app = express();

// Middleware to parse incoming JSON requests
app.use(express.json());


// In-memory database (simulated)
const users = [
    { email: "admin@gmail.com", password: "$2a$10$7Q9J1Z5F1K1J1Z5F1K1J1.Z5F1K1J1Z5F1K1J1Z5F1K1J1Z5F" } // Password is "admin123"
];

// -----------------------------------------------------------------------------
// 1. REGISTER ENDPOINT
// -----------------------------------------------------------------------------
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Check if user already exists
    const existingUser = users.find((user) => user.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists.' });
    }

    // Hash the password before saving (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save the new user
    const newUser = { email, password: hashedPassword };
    users.push(newUser);

    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// -----------------------------------------------------------------------------
// 2. LOGIN ENDPOINT
// -----------------------------------------------------------------------------
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find the user in our mock database
    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Compare the entered password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    res.status(200).json({ message: 'Login successful!' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});