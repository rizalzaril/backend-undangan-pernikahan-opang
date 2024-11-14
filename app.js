require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} = require("firebase/firestore");
const cors = require("cors");
const multer = require("multer");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const serviceAccount = require("./serviceAccountKey.json");

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL, // Use the .env variable for the database URL
  });
}

// Initialize Firebase (new modular SDK v9+)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/";

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// Middleware for authenticating the token
const authenticateToken = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Initialize the Express app and Firestore
const app = express();
const firebaseApp = initializeApp(firebaseConfig);
const dbLocale = getFirestore(firebaseApp);
const db = admin.firestore();

// Allow CORS from the specific frontend origin
app.use(
  cors({
    origin: "https://web-wedding-invitation-umber.vercel.app/", // Add the correct origin here
    methods: ["GET", "POST", "PUT", "DELETE"], // Adjust methods as necessary
    allowedHeaders: ["Content-Type", "Authorization"], // Specify allowed headers
  })
);

app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    "https://web-wedding-invitation-umber.vercel.app"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Use the authentication middleware only for routes that require authentication
app.use(bodyParser.json());

// Route to generate a custom token for a specific user (server-side token creation)
app.post("/getToken", async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ message: "UID is required" });
  }

  try {
    const customToken = await admin.auth().createCustomToken(uid);
    res.json({ token: customToken });
  } catch (error) {
    console.error("Error generating custom token:", error);
    res.status(500).json({ message: "Error generating custom token" });
  }
});

app.post("/verifToken", async (req, res) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).send("Token is required");
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    res
      .status(200)
      .send({ message: "Token verified", userId: decodedToken.uid });
  } catch (error) {
    res.status(401).send("Invalid token");
  }
});

// ************************************************ ROUTE SCRIPT *******************************************************\\

// User sign-up route
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }
  try {
    const userRecord = await admin.auth().createUser({ email, password });
    const token = await admin.auth().createCustomToken(userRecord.uid);
    res.status(201).json({ message: "User created successfully", token });
  } catch (error) {
    console.error("Sign-up error:", error);
    res
      .status(500)
      .json({ message: "User registration failed", error: error.message });
  }
});

// User login route
app.post("/login", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the user exists using Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(email);

    // Generate a custom token
    const token = await admin.auth().createCustomToken(userRecord.uid);

    // Send the token in the response
    res.status(200).json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Authentication failed" });
  }
});

// Create: Add invitation data to Firestore
app.post("/invitations", async (req, res) => {
  const { nama, status, pesan } = req.body;

  if (!nama || !status || !pesan) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "invitations"), {
      nama,
      status,
      pesan,
      timestamp: serverTimestamp(),
    });

    res
      .status(201)
      .json({ message: "Invitation added successfully", id: docRef.id });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add invitation" });
  }
});

// Read: Get all invitations from Firestore (no auth required)
app.get("/invitations", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "invitations"));
    const invitations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(invitations);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    res.status(500).json({ message: "Failed to fetch invitations" });
  }
});

// Update: Update an invitation's status and message
app.put("/invitations/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, pesan } = req.body;

  if (!status || !pesan) {
    return res
      .status(400)
      .json({ message: "Status and message are required." });
  }

  try {
    const docRef = doc(dbLocale, "invitations", id);
    await updateDoc(docRef, {
      status,
      pesan,
      timestamp: serverTimestamp(),
    });
    res.status(200).json({ message: "Invitation updated successfully" });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ message: "Failed to update invitation" });
  }
});

// Delete: Remove an invitation from Firestore
app.delete("/invitations/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const docRef = doc(dbLocale, "invitations", id);
    await deleteDoc(docRef);
    res.status(200).json({ message: "Invitation deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete invitation" });
  }
});

// File upload functionality for gallery
const upload = multer({ storage: storage });

app.post("/uploadGallery", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const filePath = path.join(__dirname, "uploads", req.file.filename);

  try {
    const imageUrl = await uploadFileToCloudinary(filePath);

    const docRef = await addDoc(collection(dbLocale, "imageGallery"), {
      imageUrl,
      timestamp: serverTimestamp(),
    });

    res.status(201).json({
      message: "Gallery Photo added successfully",
      id: docRef.id,
      imageUrl: imageUrl,
    });
  } catch (error) {
    console.error("Error adding Gallery Photo:", error);
    res.status(500).json({ message: "Failed to add Gallery Photo" });
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting uploaded file:", err);
      }
    });
  }
});

app.get("/getGallery", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "imageGallery"));
    const images = snapshot.docs.map((doc) => ({
      id: doc.id,
      imageUrl: doc.data().imageUrl,
      timestamp: doc.data().timestamp,
    }));
    res.status(200).json(images);
  } catch (error) {
    console.error("Error retrieving images:", error);
    res.status(500).json({ message: "Failed to retrieve images" });
  }
});

// Upload image to Cloudinary
async function uploadFileToCloudinary(filePath) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result.secure_url);
      }
    });
  });
}

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
