const express = require("express");
const bodyParser = require("body-parser");
const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} = require("firebase/storage");
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
  storageBucket: "web-undangan-42f23.appspot.com", // Fixed Storage URL
  messagingSenderId: "17080874518",
  appId: "1:17080874518:web:2d777ba3f7003e1b432737",
};

const app = express();
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const storageFs = getStorage(firebaseApp);

app.use(cors());
app.use(bodyParser.json());

// Multer setup for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload image to Firebase Storage
const uploadImageToFirebase = async (file) => {
  const fileName = `uploads/${Date.now()}_${file.originalname}`;
  const storageRef = ref(storageFs, fileName);
  await uploadBytes(storageRef, file.buffer);
  return await getDownloadURL(storageRef);
};

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

// POST route for gallery upload
app.post("/uploadGallery", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  try {
    const imageUrl = await uploadImageToFirebase(req.file);
    const docRef = await addDoc(collection(db, "imageGallery"), {
      imageUrl,
      timestamp: serverTimestamp(),
    });
    res.status(201).json({
      message: "Gallery Photo added successfully",
      id: docRef.id,
      imageUrl,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ message: "Failed to add Gallery Photo" });
  }
});

//GET gallery image
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
    const docSnap = await getDocs(docRef);
    if (!docSnap.exists()) {
      return res.status(404).json({ message: "Image not found" });
    }

    const { imageUrl } = docSnap.data();
    const fileName = imageUrl.split("/").pop(); // Get Firebase file reference
    const fileRef = ref(storageFs, `uploads/${fileName}`);
    await deleteObject(fileRef); // Delete image from Firebase Storage
    await deleteDoc(docRef); // Delete document from Firestore

    res.status(200).json({ message: "Gallery Photo deleted successfully" });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete Gallery Photo" });
  }
});

// Serve static files in uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
