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
  orderBy,
} = require("firebase/firestore");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");

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

// Initialize the Express app and Firestore
const app = express();
// Middleware to increase payload size limit (set to 50MB here)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
const firebaseApp = initializeApp(firebaseConfig);
const dbLocale = getFirestore(firebaseApp);

// Multer storage configuration

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
  },
}).single("file"); // Expect a single file with the field name "file"

// Allow CORS from the specific frontend origin
app.use(
  cors({
    origin: "*", // Add the correct origin here
  })
);

// Body parser for JSON requests
app.use(bodyParser.json());

// ************************************************ ROUTE SCRIPT *******************************************************\\

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

// Function to upload to Cloudinary with detailed error handling
app.post("/uploadGallery", upload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    // Function to upload image to Cloudinary
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "auto" }, // Auto-detect file type
          (error, result) => {
            if (error) {
              return reject(new Error("Failed to upload image to Cloudinary"));
            }
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
    };

    const cloudinaryResult = await uploadToCloudinary();

    // Save metadata to Firestore
    const docRef = await addDoc(collection(dbLocale, "imageGallery"), {
      imageUrl: cloudinaryResult.secure_url,
      timestamp: serverTimestamp(),
    });

    res.status(201).json({
      message: "Gallery Photo added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
    });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    res
      .status(500)
      .json({ message: "Error uploading image", error: error.message });
  }
});

// Get images from Firestore
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

// Delete an image by ID
app.delete("/deleteGallery/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(dbLocale, "imageGallery", id));
    res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ message: "Failed to delete image" });
  }
});

///////////////////////////////////////////////////// ROUTES DATA TAMU ////////////////////////////////////////////////////////////////////

// Add guest
app.post("/tamu", async (req, res) => {
  const { nama_tamu, url } = req.body;

  if (!nama_tamu || !url) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "tamu"), {
      nama_tamu,
      url,
      timestamp: serverTimestamp(),
    });

    res
      .status(201)
      .json({ message: "Guest added successfully", id: docRef.id });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add Guest" });
  }
});

// Get all guests (order by timestamp descending)
app.get("/getTamu", async (req, res) => {
  try {
    const snapshot = await getDocs(
      collection(dbLocale, "tamu"),
      orderBy("timestamp", "desc") // Ordering by timestamp in descending order
    );
    const tamu = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(tamu);
  } catch (error) {
    console.error("Error fetching tamu:", error);
    res.status(500).json({ message: "Failed to fetch tamu" });
  }
});

// ******************************************* JADWAL ROUTE *****************************************\\

// Create: Add jadwal akad data to Firestore
app.post("/postJadwalAkad", async (req, res) => {
  const { tanggal, jam } = req.body;

  if (!tanggal || !jam) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "jadwalAkad"), {
      tanggal,
      jam,
      timestamp: serverTimestamp(),
    });

    res
      .status(201)
      .json({ message: "Jadwal Akad added successfully", id: docRef.id });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add Jadwal Akad" });
  }
});

// Read: Get all jadwal akad from Firestore (no auth required)
app.get("/getJadwalAkad", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "jadwalAkad"));
    const jadwalAkad = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(jadwalAkad);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    res.status(500).json({ message: "Failed to fetch Jadwal Akad" });
  }
});

// Update: Update an jadwal akad status and message
app.put("/updateJadwalAkad/:id", async (req, res) => {
  const { id } = req.params;
  const { tanggal, jam } = req.body;

  if (!tanggal || !jam) {
    return res
      .status(400)
      .json({ message: "Status and message are required." });
  }

  try {
    const docRef = doc(dbLocale, "jadwalAkad", id);
    await updateDoc(docRef, {
      tanggal,
      jam,
      timestamp: serverTimestamp(),
    });
    res.status(200).json({ message: "Jadwal Akad updated successfully" });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ message: "Failed to update Jadwal Akad" });
  }
});

// ********** JADWAL RESEPSI ********** \\
app.post("/postJadwalResepsi", async (req, res) => {
  const { tanggal, jam } = req.body;

  if (!tanggal || !jam) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "jadwalResepsi"), {
      tanggal,
      jam,
      timestamp: serverTimestamp(),
    });

    res
      .status(201)
      .json({ message: "Jadwal Resepsi added successfully", id: docRef.id });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add Jadwal Resepsi" });
  }
});

// Read: Get all jadwal akad from Firestore (no auth required)
app.get("/getJadwalResepsi", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "jadwalResepsi"));
    const jadwalResepsi = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(jadwalResepsi);
  } catch (error) {
    console.error("Error fetching jadwal resepsi:", error);
    res.status(500).json({ message: "Failed to fetch jadwal resepsi" });
  }
});

// Update: Update an jadwal akad status and message
app.put("/updateJadwalResepsi/:id", async (req, res) => {
  const { id } = req.params;
  const { tanggal, jam } = req.body;

  if (!tanggal || !jam) {
    return res
      .status(400)
      .json({ message: "Status and message are required." });
  }

  try {
    const docRef = doc(dbLocale, "jadwalResepsi", id);
    await updateDoc(docRef, {
      tanggal,
      jam,
      timestamp: serverTimestamp(),
    });
    res.status(200).json({ message: "Jadwal Resepsi updated successfully" });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ message: "Failed to update Jadwal Akad" });
  }
});

// *************** MAPS SETTING *********** \\

app.post("/postMaps", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "maps"), {
      url,
      timestamp: serverTimestamp(),
    });

    res.status(201).json({ message: "Maps added successfully", id: docRef.id });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add maps Resepsi" });
  }
});

// Read: Get all maps  from Firestore (no auth required)
app.get("/getMaps", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "maps"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching jadwal resepsi:", error);
    res.status(500).json({ message: "Failed to fetch jadwal resepsi" });
  }
});

// Update: Update an maps status and message
app.put("/updateMaps/:id", async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;

  if (!url) {
    return res
      .status(400)
      .json({ message: "Status and message are required." });
  }

  try {
    const docRef = doc(dbLocale, "maps", id);
    await updateDoc(docRef, {
      url,
      timestamp: serverTimestamp(),
    });
    res.status(200).json({ message: "Maps updated successfully" });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ message: "Failed to update maps" });
  }
});

// ******************** MEMPELAI SETTING ***************** \\

// MEMPELAI PRIA \\

app.post("/postMempelaiPria", upload, async (req, res) => {
  const { caption, nama } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!caption || !nama) {
    return res.status(400).json({ message: "Nama is required." });
  }

  try {
    // Fungsi untuk mengunggah gambar ke Cloudinary
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "auto" }, // Auto-detect file type
          (error, result) => {
            if (error) {
              return reject(new Error("Failed to upload image to Cloudinary"));
            }
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
    };

    // Upload ke Cloudinary
    const cloudinaryResult = await uploadToCloudinary();

    // Simpan metadata ke Firestore
    const docRef = await addDoc(collection(dbLocale, "mempelaiPria"), {
      imageUrl: cloudinaryResult.secure_url,
      caption,
      nama,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Mempelai Pria added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
      caption,
      nama,
    });
  } catch (error) {
    // Log error dan kirim response error
    console.error("Error:", error.message);
    res.status(500).json({
      message: "An error occurred while processing your request.",
      error: error.message,
    });
  }
});

app.put("/updateMempelaiPria/:id", upload, async (req, res) => {
  const { id } = req.params;
  const { caption, nama } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "mempelaiPria", id);

    let updatedData = { caption, nama };

    // Jika ada file, upload ke Cloudinary dan tambahkan URL baru
    if (req.file) {
      const uploadToCloudinary = () => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
              if (error) {
                return reject(
                  new Error("Failed to upload image to Cloudinary")
                );
              }
              resolve(result);
            }
          );
          uploadStream.end(req.file.buffer);
        });
      };

      const cloudinaryResult = await uploadToCloudinary();
      updatedData.imageUrl = cloudinaryResult.secure_url;
    }

    // Update Firestore
    await updateDoc(docRef, {
      ...updatedData,
      timestamp: serverTimestamp(), // Perbarui timestamp
    });

    // Response berhasil
    res.status(200).json({
      message: "Mempelai Pria updated successfully.",
      id,
      ...updatedData,
    });
  } catch (error) {
    // Log error dan kirim response error
    console.error("Error:", error.message);
    res.status(500).json({
      message: "An error occurred while processing your request.",
      error: error.message,
    });
  }
});

app.get("/getMempelaiPria", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "mempelaiPria"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching jadwal resepsi:", error);
    res.status(500).json({ message: "Failed to fetch jadwal resepsi" });
  }
});

// MEMPELAI WANITA \\

app.post("/postMempelaiWanita", upload, async (req, res) => {
  const { caption, nama } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!caption || !nama) {
    return res.status(400).json({ message: "Nama is required." });
  }

  try {
    // Fungsi untuk mengunggah gambar ke Cloudinary
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "auto" }, // Auto-detect file type
          (error, result) => {
            if (error) {
              return reject(new Error("Failed to upload image to Cloudinary"));
            }
            resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
    };

    // Upload ke Cloudinary
    const cloudinaryResult = await uploadToCloudinary();

    // Simpan metadata ke Firestore
    const docRef = await addDoc(collection(dbLocale, "mempelaiWanita"), {
      imageUrl: cloudinaryResult.secure_url,
      caption,
      nama,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Mempelai Pria added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
      caption,
      nama,
    });
  } catch (error) {
    // Log error dan kirim response error
    console.error("Error:", error.message);
    res.status(500).json({
      message: "An error occurred while processing your request.",
      error: error.message,
    });
  }
});

app.put("/updateMempelaiWanita/:id", upload, async (req, res) => {
  const { id } = req.params;
  const { caption, nama } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "mempelaiWanita", id);

    let updatedData = { caption, nama };

    // Jika ada file, upload ke Cloudinary dan tambahkan URL baru
    if (req.file) {
      const uploadToCloudinary = () => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
              if (error) {
                return reject(
                  new Error("Failed to upload image to Cloudinary")
                );
              }
              resolve(result);
            }
          );
          uploadStream.end(req.file.buffer);
        });
      };

      const cloudinaryResult = await uploadToCloudinary();
      updatedData.imageUrl = cloudinaryResult.secure_url;
    }

    // Update Firestore
    await updateDoc(docRef, {
      ...updatedData,
      timestamp: serverTimestamp(), // Perbarui timestamp
    });

    // Response berhasil
    res.status(200).json({
      message: "Mempelai Pria updated successfully.",
      id,
      ...updatedData,
    });
  } catch (error) {
    // Log error dan kirim response error
    console.error("Error:", error.message);
    res.status(500).json({
      message: "An error occurred while processing your request.",
      error: error.message,
    });
  }
});

app.get("/getMempelaiWanita", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "mempelaiWanita"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching jadwal resepsi:", error);
    res.status(500).json({ message: "Failed to fetch jadwal resepsi" });
  }
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
