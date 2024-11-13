const express = require("express");
const bodyParser = require("body-parser");

process.env.FIREBASE_DEBUG = "true"; // Enable Firebase Admin SDK debugging

const admin = require("firebase-admin");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary");
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} = require("firebase/firestore");
const serviceAccount = require("./serviceAccountKey.json"); // Replace with the actual path to your Firebase service account key

// Initialize Firebase (new modular SDK v9+)
const firebaseConfig = {
  apiKey: "AIzaSyBkA-g2xDMKxIjFAKm0rx7He0USiLI1Noc",
  authDomain: "web-undangan-42f23.firebaseapp.com",
  projectId: "web-undangan-42f23",
  storageBucket: "web-undangan-42f23.firebasestorage.app",
  messagingSenderId: "17080874518",
  appId: "1:17080874518:web:2d777ba3f7003e1b432737",
};

// Initialize Firebase app
const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://web-undangan-42f23-default-rtdb.firebaseio.com", // pastikan URL ini sesuai dengan proyek Anda
  });
}

const auth = admin.auth();
const db = admin.firestore();
const db2 = getFirestore(firebaseApp); // Firestore instance

// Cloudinary configuration
cloudinary.v2.config({
  cloud_name: "djgr3hq5k",
  api_key: "122714586646415",
  api_secret: "utEKAi7kF1ExsyUxYtF7NJ_piRM",
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Helper function to upload files to Cloudinary
const uploadFileToCloudinary = (filePath) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, (error, result) => {
      if (error) reject(error);
      else resolve(result.url);
    });
  });

// User sign-up route
// Sign-up route using Firebase Admin SDK for creating a user
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
    });
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
  const { email, password } = req.body;
  try {
    const userCredential = await auth.getUserByEmail(email); // Check if user exists
    // Password authentication can be done here via custom token generation or another method
    const token = await auth.createCustomToken(userCredential.uid);
    res.status(200).json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Authentication failed" });
  }
});

// CRUD endpoints for invitations
app.post("/invitations", async (req, res) => {
  const { nama, status, pesan } = req.body;
  if (!nama || !status || !pesan)
    return res.status(400).json({ message: "All fields are required." });

  try {
    const docRef = await addDoc(collection(db2, "invitations"), {
      nama,
      status,
      pesan,
      timestamp: serverTimestamp(),
    });
    res.status(201).json({ message: "Invitation added", id: docRef.id });
  } catch (error) {
    console.error("Error adding invitation:", error);
    res.status(500).json({ message: "Failed to add invitation" });
  }
});

app.get("/invitations", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db2, "invitations"));
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

// Upload and retrieve gallery images
app.post("/uploadGallery", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded." });

  const filePath = path.join(__dirname, "uploads", req.file.filename);
  try {
    const imageUrl = await uploadFileToCloudinary(filePath);
    const docRef = await addDoc(collection(db, "imageGallery"), {
      imageUrl,
      timestamp: serverTimestamp(),
    });
    res
      .status(201)
      .json({ message: "Gallery Photo added", id: docRef.id, imageUrl });
  } catch (error) {
    console.error("Error adding Gallery Photo:", error);
    res.status(500).json({ message: "Failed to add Gallery Photo" });
  } finally {
    // Ensure file is deleted after upload
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  }
});

app.get("/getGallery", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "imageGallery"));
    const images = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(images);
  } catch (error) {
    console.error("Error retrieving images:", error);
    res.status(500).json({ message: "Failed to retrieve images" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
