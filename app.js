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

// ******************** GALLERY SETTING ***************************** \\

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

// ******************** GALLERY CAROUSEL SETTING ***************************** \\

app.post("/uploadCarousel", upload, async (req, res) => {
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
    const docRef = await addDoc(collection(dbLocale, "imageCarousel"), {
      imageUrl: cloudinaryResult.secure_url,
      timestamp: serverTimestamp(),
    });

    res.status(201).json({
      message: "Carousel Photo added successfully",
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
app.get("/getCarousel", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "imageCarousel"));
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

app.delete("/deleteCarouselData/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await deleteDoc(doc(dbLocale, "imageCarousel", id));
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

// Delete tamu by ID
app.delete("/deleteTamu/:id", async (req, res) => {
  const { id } = req.params; // Get ID from URL params

  try {
    const tamuDoc = doc(dbLocale, "tamu", id); // Reference to the document
    await deleteDoc(tamuDoc); // Delete the document
    res.status(200).json({ message: "Tamu deleted successfully" });
  } catch (error) {
    console.error("Error deleting tamu:", error);
    res.status(500).json({ message: "Failed to delete tamu" });
  }
});

// ******************************************* JADWAL ROUTE *****************************************\\

// Create: Add jadwal akad data to Firestore
app.post("/postJadwalAkad", async (req, res) => {
  const { tanggal, jam, alamat } = req.body;

  if (!tanggal || !jam || !alamat) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "jadwalAkad"), {
      tanggal,
      jam,
      alamat,
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
  const { tanggal, jam, alamat } = req.body;

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
      alamat,
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
  const { tanggal, jam, jamSelesai, alamat } = req.body;

  if (!tanggal || !jam || !jamSelesai || !alamat) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "jadwalResepsi"), {
      tanggal,
      jam,
      jamSelesai,
      alamat,
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
  const { tanggal, jam, jamSelesai, alamat } = req.body;

  if (!tanggal || !jam || !jamSelesai) {
    return res
      .status(400)
      .json({ message: "Status and message are required." });
  }

  try {
    const docRef = doc(dbLocale, "jadwalResepsi", id);
    await updateDoc(docRef, {
      tanggal,
      jam,
      jamSelesai,
      alamat,
      timestamp: serverTimestamp(),
    });
    res.status(200).json({ message: "Jadwal Resepsi updated successfully" });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ message: "Failed to update Jadwal Akad" });
  }
});

// *************** MAPS AKAD SETTING *********** \\

app.post("/postMapsAkad", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "mapsAkad"), {
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
app.get("/getMapsAkad", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "mapsAkad"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching jadwal resepsi:", error);
    res.status(500).json({ message: "Failed to fetch maps" });
  }
});

// Update: Update an maps status and message
app.put("/updateMapsAkad/:id", async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;

  if (!url) {
    return res
      .status(400)
      .json({ message: "Status and message are required." });
  }

  try {
    const docRef = doc(dbLocale, "mapsAkad", id);
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

// *************** MAPS RESEPSI SETTING *********** \\

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
  const { caption, nama, linkInstagram } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!caption || !nama || !linkInstagram) {
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
      linkInstagram,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Mempelai Pria added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
      caption,
      linkInstagram,
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
  const { caption, nama, linkInstagram } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "mempelaiPria", id);

    let updatedData = { caption, nama, linkInstagram };

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
  const { caption, nama, linkInstagram } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!caption || !nama || !linkInstagram) {
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
  const { caption, nama, linkInstagram } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "mempelaiWanita", id);

    let updatedData = { caption, nama, linkInstagram };

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

// ************************************ SAMPUL SETTINGS ******************************** \\

app.post("/postSampul", upload, async (req, res) => {
  // const { caption, nama } = req.body;

  // Validasi input
  // if (!req.file) {
  //   return res.status(400).json({ message: "No file uploaded." });
  // }
  // if (!caption || !nama) {
  //   return res.status(400).json({ message: "Nama is required." });
  // }

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
    const docRef = await addDoc(collection(dbLocale, "sampul"), {
      imageUrl: cloudinaryResult.secure_url,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Sampul added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
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

app.put("/updateSampul/:id", upload, async (req, res) => {
  const { id } = req.params;
  const { imageUrl } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "sampul", id);

    let updatedData = { imageUrl };

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

app.get("/getSampul", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "sampul"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching Sampul:", error);
    res.status(500).json({ message: "Failed to fetch sampul" });
  }
});

// ***************************** STORY SETTING ******************************************\\

// FIRST STORY \\

app.post("/postFirstStory", upload, async (req, res) => {
  const { caption } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!caption) {
    return res.status(400).json({ message: "Caption is required." });
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
    const docRef = await addDoc(collection(dbLocale, "firstStory"), {
      imageUrl: cloudinaryResult.secure_url,
      caption,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "First Story added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
      caption,
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

app.put("/updateFirstStory/:id", upload, async (req, res) => {
  const { id } = req.params;
  const { caption } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "firstStory", id);

    let updatedData = { caption };

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
      message: "First Story updated successfully.",
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

app.get("/getFirstStory", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "firstStory"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching Sampul:", error);
    res.status(500).json({ message: "Failed to fetch sampul" });
  }
});

// SECOND STORY \\

app.post("/postSecondStory", upload, async (req, res) => {
  const { caption } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!caption) {
    return res.status(400).json({ message: "Caption is required." });
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
    const docRef = await addDoc(collection(dbLocale, "secondStory"), {
      imageUrl: cloudinaryResult.secure_url,
      caption,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Second Story added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
      caption,
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

app.put("/updateSecondStory/:id", upload, async (req, res) => {
  const { id } = req.params;
  const { caption } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "secondStory", id);

    let updatedData = { caption };

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
      message: "Second Story updated successfully.",
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

app.get("/getSecondStory", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "secondStory"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching Second story:", error);
    res.status(500).json({ message: "Failed to fetch sampul" });
  }
});

// LAST STORY \\

app.post("/postLastStory", upload, async (req, res) => {
  const { caption } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!caption) {
    return res.status(400).json({ message: "Caption is required." });
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
    const docRef = await addDoc(collection(dbLocale, "lastStory"), {
      imageUrl: cloudinaryResult.secure_url,
      caption,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Last Story added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
      caption,
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

app.put("/updateLastStory/:id", upload, async (req, res) => {
  const { id } = req.params;
  const { caption } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "lastStory", id);

    let updatedData = { caption };

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
      message: "Last Story updated successfully.",
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

app.get("/getLastStory", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "lastStory"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching Second story:", error);
    res.status(500).json({ message: "Failed to fetch sampul" });
  }
});

// *************** REKENING SETTING *********** \\

// setting bank \\

app.post("/postBank", upload, async (req, res) => {
  const { namaBank } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!namaBank) {
    return res.status(400).json({ message: "nama Bank is required." });
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
    const docRef = await addDoc(collection(dbLocale, "namaBank"), {
      imageUrl: cloudinaryResult.secure_url,
      namaBank,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Bank added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
      namaBank,
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

app.get("/getBank", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "namaBank"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching Sampul:", error);
    res.status(500).json({ message: "Failed to fetch sampul" });
  }
});

// First Rekening \\
app.post("/postFirstRekening", async (req, res) => {
  const { namaRekening, nomorRekening, bankId } = req.body;

  if (!namaRekening || !nomorRekening || !bankId) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "firstRekening"), {
      namaRekening,
      nomorRekening,
      bankId,
      timestamp: serverTimestamp(),
    });

    res.status(201).json({
      message: "Rekening Pertama added successfully",
      id: docRef.id,
      namaRekening,
      nomorRekening,
      bankId,
    });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add data" });
  }
});

// get first rekening join bank \\
app.get("/getFirstRekening", async (req, res) => {
  try {
    // Fetch firstRekening data
    const firstRekeningSnapshot = await getDocs(
      collection(dbLocale, "firstRekening")
    );
    const firstRekeningData = firstRekeningSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Fetch namaBank data
    const namaBankSnapshot = await getDocs(collection(dbLocale, "namaBank"));
    const namaBankData = namaBankSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Log data to check if bankId is now available
    console.log("First Rekening Data:", firstRekeningData);
    console.log("Nama Bank Data:", namaBankData);

    // Join the two collections based on bankId from firstRekening and id from namaBank
    const joinedData = firstRekeningData.map((rekening) => {
      console.log(`Matching bankId: ${rekening.bankId} with namaBank id`);
      // Find the corresponding bank in namaBank collection
      const bank = namaBankData.find((bank) => bank.id === rekening.bankId);
      console.log(`Found bank:`, bank);
      return {
        ...rekening,
        bankName: bank ? bank.namaBank : null, // Use 'namaBank' as the bank's name
        bankLogo: bank ? bank.imageUrl : null,
      };
    });

    // Send the combined result
    res.status(200).json(joinedData);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Failed to fetch data" });
  }
});

// Update: Update an maps status and message
app.put("/updateFirstRekening/:id", async (req, res) => {
  const { id } = req.params;
  const { namaRekening, nomorRekening, bankId } = req.body;

  if (!namaRekening || !nomorRekening || !bankId) {
    return res
      .status(400)
      .json({ message: "Status and message are required." });
  }

  try {
    const docRef = doc(dbLocale, "firstRekening", id);
    await updateDoc(docRef, {
      namaRekening,
      nomorRekening,
      bankId,
      timestamp: serverTimestamp(),
    });
    res.status(200).json({ message: "Rekening Pertama updated successfully" });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ message: "Failed to update data" });
  }
});

// Second Rekening \\

app.post("/postSecondRekening", async (req, res) => {
  const { namaRekening, nomorRekening, bankId } = req.body;

  if (!namaRekening || !nomorRekening || !bankId) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const docRef = await addDoc(collection(dbLocale, "secondRekening"), {
      namaRekening,
      nomorRekening,
      bankId,
      timestamp: serverTimestamp(),
    });

    res.status(201).json({
      message: "Rekening Kedua added successfully",
      id: docRef.id,
      namaRekening,
      nomorRekening,
      bankId,
    });
  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ message: "Failed to add data" });
  }
});

// get first rekening join bank \\
app.get("/getSecondRekening", async (req, res) => {
  try {
    // Fetch firstRekening data
    const secondRekeningSnapshot = await getDocs(
      collection(dbLocale, "secondRekening")
    );
    const secondRekeningData = secondRekeningSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Fetch namaBank data
    const namaBankSnapshot = await getDocs(collection(dbLocale, "namaBank"));
    const namaBankData = namaBankSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Log data to check if bankId is now available
    console.log("Second Rekening Data:", secondRekeningData);
    console.log("Nama Bank Data:", namaBankData);

    // Join the two collections based on bankId from firstRekening and id from namaBank
    const joinedData = secondRekeningData.map((rekening) => {
      console.log(`Matching bankId: ${rekening.bankId} with namaBank id`);
      // Find the corresponding bank in namaBank collection
      const bank = namaBankData.find((bank) => bank.id === rekening.bankId);
      console.log(`Found bank:`, bank);
      return {
        ...rekening,
        bankName: bank ? bank.namaBank : null, // Use 'namaBank' as the bank's name
        bankLogo: bank ? bank.imageUrl : null,
      };
    });

    // Send the combined result
    res.status(200).json(joinedData);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ message: "Failed to fetch data" });
  }
});

// Update: Update an maps status and message
app.put("/updateSecondRekening/:id", async (req, res) => {
  const { id } = req.params;
  const { namaRekening, nomorRekening, bankId } = req.body;

  if (!namaRekening || !nomorRekening || !bankId) {
    return res
      .status(400)
      .json({ message: "Status and message are required." });
  }

  try {
    const docRef = doc(dbLocale, "secondRekening", id);
    await updateDoc(docRef, {
      namaRekening,
      nomorRekening,
      bankId,
      timestamp: serverTimestamp(),
    });
    res.status(200).json({ message: "Rekening Kedua updated successfully" });
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ message: "Failed to update data" });
  }
});

// ************************** UPLOAD BARANG SHOPEE *********************** \\
app.post("/postBarang", upload, async (req, res) => {
  const { namaBarang, linkShopee } = req.body;

  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }
  if (!namaBarang || !linkShopee) {
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
    const docRef = await addDoc(collection(dbLocale, "giftBarang"), {
      imageUrl: cloudinaryResult.secure_url,
      namaBarang,
      linkShopee,
      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Barang added successfully",
      id: docRef.id,
      imageUrl: cloudinaryResult.secure_url,
      namaBarang,
      linkShopee,
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

app.put("/updatebarang/:id", upload, async (req, res) => {
  const { id } = req.params;
  const { namaBarang, linkShopee } = req.body;

  try {
    // Validasi keberadaan dokumen
    const docRef = doc(dbLocale, "giftBarang", id);

    let updatedData = { namaBarang, linkShopee };

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
      message: "Barang updated successfully.",
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

app.get("/getBarang", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "giftBarang"));
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

// Mendapatkan barang berdasarkan ID
app.get("/getBarangById/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const docRef = doc(dbLocale, "giftBarang", id);
    const docSnap = await getDocs(docRef);

    if (docSnap.exists()) {
      res.status(200).json({ id: docSnap.id, ...docSnap.data() });
    } else {
      res.status(404).json({ message: "Barang not found" });
    }
  } catch (error) {
    console.error("Error fetching giftBarang by ID:", error);
    res.status(500).json({ message: "Failed to fetch giftBarang by ID" });
  }
});

app.delete("/deleteBarang/:id", async (req, res) => {
  const { id } = req.params; // Ambil ID dari parameter URL
  try {
    const docRef = doc(dbLocale, "giftBarang", id); // Referensi dokumen berdasarkan ID
    await deleteDoc(docRef); // Hapus dokumen
    res.status(200).json({ message: "Barang berhasil dihapus" });
  } catch (error) {
    console.error("Error deleting barang:", error);
    res
      .status(500)
      .json({ message: "Failed to delete barang", error: error.message });
  }
});

// *********************** BACK SOUND UPLOAD ************************ \\
app.post("/postSound", upload, async (req, res) => {
  // Validasi input
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  // Validasi format file
  const allowedFormats = ["audio/mpeg", "audio/wav"]; // MIME types for mp3 and wav
  if (!allowedFormats.includes(req.file.mimetype)) {
    return res
      .status(400)
      .json({ message: "Invalid file format. Only MP3 and WAV are allowed." });
  }

  try {
    // Fungsi untuk mengunggah file ke Cloudinary
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "auto" }, // Auto-detect file type
          (error, result) => {
            if (error) {
              return reject(new Error("Failed to upload file to Cloudinary"));
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
    const docRef = await addDoc(collection(dbLocale, "backsound"), {
      fileUrl: cloudinaryResult.secure_url,

      timestamp: serverTimestamp(),
    });

    // Response berhasil
    res.status(201).json({
      message: "Backsound added successfully",
      id: docRef.id,
      fileUrl: cloudinaryResult.secure_url,
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

app.get("/getSound", async (req, res) => {
  try {
    const snapshot = await getDocs(collection(dbLocale, "backsound"));
    const maps = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(maps);
  } catch (error) {
    console.error("Error fetching Second story:", error);
    res.status(500).json({ message: "Failed to fetch sampul" });
  }
});

app.put("/updateSound/:id", upload, async (req, res) => {
  const { id } = req.params; // ID dokumen backsound
  const allowedFormats = ["audio/mpeg", "audio/wav"]; // MIME types for MP3 and WAV

  try {
    // Referensi ke dokumen di Firestore
    const docRef = doc(dbLocale, "backsound", id);

    // Periksa apakah dokumen ada
    const docSnapshot = await getDoc(docRef);
    if (!docSnapshot.exists()) {
      return res.status(404).json({ message: "Backsound not found." });
    }

    let newFileUrl = docSnapshot.data().fileUrl; // Default: URL lama dari Firestore

    // Jika file baru diunggah, validasi format dan upload ke Cloudinary
    if (req.file) {
      if (!allowedFormats.includes(req.file.mimetype)) {
        return res.status(400).json({
          message: "Invalid file format. Only MP3 and WAV are allowed.",
        });
      }

      // Fungsi untuk mengunggah file baru ke Cloudinary
      const uploadToCloudinary = () => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" }, // Auto-detect file type
            (error, result) => {
              if (error) {
                return reject(new Error("Failed to upload file to Cloudinary"));
              }
              resolve(result);
            }
          );
          uploadStream.end(req.file.buffer);
        });
      };

      const cloudinaryResult = await uploadToCloudinary();
      newFileUrl = cloudinaryResult.secure_url; // URL file baru
    }

    // Update dokumen di Firestore
    await updateDoc(docRef, {
      fileUrl: newFileUrl, // Update URL file
      timestamp: serverTimestamp(), // Update timestamp
    });

    // Response berhasil
    res.status(200).json({
      message: "Backsound updated successfully.",
      id,
      fileUrl: newFileUrl,
    });
  } catch (error) {
    // Log error dan kirim response error
    console.error("Error:", error.message);
    res.status(500).json({
      message: "An error occurred while updating the backsound.",
      error: error.message,
    });
  }
});

// Server setup
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
