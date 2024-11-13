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
    databaseURL: "https://web-undangan-42f23-default-rtdb.firebaseio.com", // Ensure this URL matches your project
  });
}

// Initialize Firebase (new modular SDK v9+)
const firebaseConfig = {
  apiKey: "AIzaSyBkA-g2xDMKxIjFAKm0rx7He0USiLI1Noc",
  authDomain: "web-undangan-42f23.firebaseapp.com",
  projectId: "web-undangan-42f23",
  storageBucket: "web-undangan-42f23.firebasestorage.app",
  messagingSenderId: "17080874518",
  appId: "1:17080874518:web:2d777ba3f7003e1b432737",
};

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: "djgr3hq5k",
  api_key: "122714586646415",
  api_secret: "utEKAi7kF1ExsyUxYtF7NJ_piRM",
});

const uploadFileToCloudinary = (filePath) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, (error, result) => {
      if (error) {
        console.error("Upload failed:", error);
        reject(error);
      } else {
        console.log("File uploaded successfully:", result.url);
        resolve(result.url);
      }
    });
  });
};

// Configure multer storage
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

/// DB //////
const app = express();
const firebaseApp = initializeApp(firebaseConfig);
const dbLocale = getFirestore(firebaseApp);
const auth = admin.auth();
const db = admin.firestore();
app.use(cors());
app.use(bodyParser.json());

// AUTH TOKEN ///
const authenticateToken = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Get token from "Bearer <token>"

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  try {
    // Verify the custom token and get user data
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Store user data in the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(403).json({ message: "Invalid or expired token" });
  }
};

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
    const userCredential = await auth.getUserByEmail(email); // Check if user exists
    const token = await auth.createCustomToken(userCredential.uid);
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

// Read: Get all invitations from Firestore
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
app.put("/invitations/:id", async (req, res) => {
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
app.delete("/invitations/:id", async (req, res) => {
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

const upload = multer({ storage: storage });

// POST gallery photo
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
      if (err) console.error("Error deleting local file:", err);
    });
  }
});

// GET gallery images
app.get("/getGallery", authenticateToken, async (req, res) => {
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

// Delete image route
app.delete("/deleteGallery/:id", async (req, res) => {
  const imageId = req.params.id;

  try {
    const docRef = doc(db, "imageGallery", imageId);
    await deleteDoc(docRef);

    res.status(200).json({ message: "Gallery Photo deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete Gallery Photo" });
  }
});

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
