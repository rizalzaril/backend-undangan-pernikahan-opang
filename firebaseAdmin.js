// firebaseConfig.js

require("dotenv").config();

const firebaseAdminConfig = {
  type: process.env.FIREBASE_TYPE_ACCOUNT,
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  clientId: process.env.FIREBASE_CLIENT_ID,
  authUri: process.env.FIREBASE_AUTH_URI,
  tokenUri: process.env.FIREBASE_TOKEN_URI,
  authProviderCertUrl: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  clientCertUrl: process.env.FIREBASE_CLIENT_X509_CERT_URL,
};

module.exports = firebaseAdminConfig;
