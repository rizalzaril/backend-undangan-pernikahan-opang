// Required imports and configurations
import express from "express";
import bodyParser from "body-parser";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import cloudinary from "cloudinary";

import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

// Firebase and Cloudinary configurations (use environment variables for security)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth();

// Helper function to upload file to Cloudinary
const uploadFileToCloudinary = (filePath) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, (error, result) => {
      if (error) reject(error);
      else resolve(result.url);
    });
  });

// Multer configuration
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

app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// User authentication route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    const token = await userCredential.user.getIdToken();
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
    const docRef = await addDoc(collection(db, "invitations"), {
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
    const snapshot = await getDocs(collection(db, "invitations"));
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
