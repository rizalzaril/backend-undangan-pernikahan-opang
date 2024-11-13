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

const firebaseConfig = {
  apiKey: "AIzaSyBkA-g2xDMKxIjFAKm0rx7He0USiLI1Noc",
  authDomain: "web-undangan-42f23.firebaseapp.com",
  projectId: "web-undangan-42f23",
  storageBucket: "web-undangan-42f23.firebasestorage.app",
  messagingSenderId: "17080874518",
  appId: "1:17080874518:web:2d777ba3f7003e1b432737",
};

const app = express();
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

app.use(cors());
app.use(bodyParser.json());

// Multer setup for handling file uploads with file type validation (png, jpg)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Only allow png and jpg files
    const allowedTypes = /png|jpg/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      return cb(new Error("Only .png and .jpg files are allowed"), false);
    }
  },
});

// POST route for adding invitations
app.post("/invitations", async (req, res) => {
  const { nama, status, pesan } = req.body;
  if (!nama || !status || !pesan) {
    return res.status(400).json({ message: "All fields are required." });
  }
  try {
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

// Modified POST route for gallery upload (storing only image URL/path as string)
app.post("/uploadGallery", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    // Store only the image file path or URL as a string
    const imagePath = `https://backend-undangan-pernikahan-opang.vercel.app//uploads/${Date.now()}_${
      req.file.originalname
    }`;

    // Add the image path to Firestore
    const docRef = await addDoc(collection(db, "imageGallery"), {
      imagePath,
      timestamp: serverTimestamp(),
    });

    res.status(201).json({
      message: "Gallery Photo added successfully",
      id: docRef.id,
      imagePath: imagePath,
    });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add Gallery Photo" });
  }
});

// GET all gallery images
app.get("/getGallery", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(db, "imageGallery"));
    const images = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(images);
  } catch (error) {
    console.error("Error retrieving images:", error);
    res.status(500).json({ message: "Failed to retrieve images" });
  }
});

// GET all invitations
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

// Update invitation
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

// Delete invitation
app.delete("/invitations/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(db, "invitations", id));
    res.status(200).json({ message: "Invitation deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete invitation" });
  }
});

// Delete gallery photo
app.delete("/deleteGallery/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const docRef = doc(db, "imageGallery", id);
    await deleteDoc(docRef); // Simply delete the document from Firestore
    res.status(200).json({ message: "Gallery Photo deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete Gallery Photo" });
  }
});

// Serve static files in uploads folder (you can put images here if needed)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
