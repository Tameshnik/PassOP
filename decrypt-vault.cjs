const fs = require("fs");
const CryptoJS = require("crypto-js");

if (process.argv.length < 4) {
  console.error("Usage: node decrypt-vault.js <file> <masterPassword>");
  process.exit(1);
}

const filePath = process.argv[2];
const masterPassword = process.argv[3];

// Read file
const encryptedJson = JSON.parse(fs.readFileSync(filePath, "utf8"));

try {
  // Derive key using PBKDF2
  const key = CryptoJS.PBKDF2(masterPassword, CryptoJS.enc.Base64.parse(encryptedJson.salt), {
    keySize: 256 / 32,
    iterations: encryptedJson.iter,
  });

  // Decrypt AES-CBC
  const decrypted = CryptoJS.AES.decrypt(
    { ciphertext: CryptoJS.enc.Base64.parse(encryptedJson.ct) },
    key,
    {
      iv: CryptoJS.enc.Base64.parse(encryptedJson.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  );

  const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

  if (!decryptedText) {
    throw new Error("Wrong password or corrupted file");
  }

  console.log("✅ Decrypted Data:");
  console.log(JSON.parse(decryptedText));
} catch (err) {
  console.error("❌ Decryption failed:", err.message);
}
