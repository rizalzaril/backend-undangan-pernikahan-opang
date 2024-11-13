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
const path = require("path");
const fs = require("fs");

// Initialize Firebase (new modular SDK v9+)
const firebaseConfig = {
  apiKey: "AIzaSyBkA-g2xDMKxIjFAKm0rx7He0USiLI1Noc",
  authDomain: "web-undangan-42f23.firebaseapp.com",
  projectId: "web-undangan-42f23",
  storageBucket: "web-undangan-42f23.firebasestorage.app",
  messagingSenderId: "17080874518",
  appId: "1:17080874518:web:2d777ba3f7003e1b432737",
};

const app = express();

// Initialize Firebase app
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp); // Firestore instance

// Enable CORS for all origins (for development only)
app.use(cors({ origin: "*" }));

app.use(bodyParser.json());

// Create: Add invitation data to Firestore
app.post("/invitations", async (req, res) => {
  const { nama, status, pesan } = req.body;

  // Check if all fields are provided
  if (!nama || !status || !pesan) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Add the invitation to Firestore
    const docRef = await addDoc(collection(db, "invitations"), {
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
    const docRef = doc(db, "invitations", id);
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
    const docRef = doc(db, "invitations", id);
    await deleteDoc(docRef);
    res.status(200).json({ message: "Invitation deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete invitation" });
  }
});

// Upload Gallery Photo (file upload endpoint)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Create 'uploads' directory if it doesn't exist
    }
    cb(null, uploadDir); // Define folder to store files
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({ storage: storage });

// POST gallery photo
app.post("/uploadGallery", upload.single("image"), async (req, res) => {
  console.log(req.body); // Log the body to ensure it's correct
  console.log(req.file); // Log the file to check if it's uploaded

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const imageUrl = `https://backend-undangan-pernikahan-opang.vercel.app/uploads/${req.file.filename}`;
  try {
    // Add the image URL to Firestore
    const docRef = await addDoc(collection(db, "imageGallery"), {
      imageUrl,
      timestamp: serverTimestamp(),
    });

    res.status(201).json({
      message: "Gallery Photo added successfully",
      id: docRef.id,
      imageUrl: imageUrl,
    });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add Gallery Photo" });
  }
});

// GET gallery images
app.get("/getGallery", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "imageGallery"));
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
    const docSnap = await docRef.get();

    if (!docSnap.exists()) {
      return res.status(404).json({ message: "Image not found" });
    }

    const imageUrl = docSnap.data().imageUrl;
    const fileName = imageUrl.split("/").pop(); // Get the file name from URL

    const filePath = path.join(__dirname, "uploads", fileName);

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting the file:", err);
        return res
          .status(500)
          .json({ message: "Failed to delete image from server" });
      }
    });

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
