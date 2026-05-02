import bcrypt from "bcryptjs";
import { UserModel } from "../models/userModel.js";
import { generateToken } from "../utils/tokenUtils.js";
import { OAuth2Client } from "google-auth-library";
// VALIDATION HELPERS 
const client = new OAuth2Client(
  "1063358640985-8l0c1luv17umno22ehhapts0mhj1thor.apps.googleusercontent.com"
);

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
const isStrongPassword = (password) => {
  const pwRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
  return pwRegex.test(password);
};

const hashPassword = (plain) => bcrypt.hashSync(plain, 10);

const checkPassword = (plain, hashed) => bcrypt.compareSync(plain, hashed);

// REGISTER USER 
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role = "citizen" } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Name, email, and password are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
      });
    }

    const existing = await UserModel.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({
        error: "User already exists",
      });
    }

    const newUser = await UserModel.createUser({
      name,
      email,
      password: hashPassword(password),
      role,
      createdAt: new Date().toISOString(),
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: newUser,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// LOGIN USER 
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }
    const user = await UserModel.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }
    const isMatch = checkPassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid credentials",
      });
    }
    const token = generateToken(user);

    return res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
export const googleAuth = async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: [
        "1063358640985-8l0c1luv17umno22ehhapts0mhj1thor.apps.googleusercontent.com",
        "1063358640985-29tt8mdak3so9fponsk74qm3rnm2o51b.apps.googleusercontent.com"
      ],
    });

    const payload = ticket.getPayload();

    const email = payload.email;
    const name = payload.name;

    let user = await UserModel.getUserByEmail(email);

    if (!user) {
      user = await UserModel.createUser({
        name,
        email,
        password: "google-user",
        role: "citizen",
        createdAt: new Date().toISOString(),
      });
    }

    const jwtToken = generateToken(user);

    res.json({ 
      message: "Google login success", 
      token: jwtToken, 
      user 
    });

  } catch (err) {
    console.error("GOOGLE AUTH ERROR:", err);
    res.status(500).json({ error: "Google auth failed" });
  }
};



