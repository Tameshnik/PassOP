import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import bcrypt from 'bcryptjs';
import 'react-toastify/dist/ReactToastify.css';

/**
 * SECURITY-HARDENED VERSION (+ Generator Component + Edit Modal)
 * - AES-CBC with random IV, key derived via PBKDF2 (200k iters) from master password + random salt
 * - Crypto-secure password generator (window.crypto.getRandomValues)
 * - Auto-lock on inactivity & on tab hide
 * - Export/Import encrypted vault
 * - Seamless migration from legacy plaintext and from prior passphrase-based AES vault
 * - Added: Reusable PasswordGenerator component
 * - Added: EditModal for in-place editing without removing entries
 */

/** LocalStorage keys */
const LS_KEYS = {
  VAULT: 'pm_passwords_enc',      // encrypted vault blob (JSON string)
  MASTER_HASH: 'pm_master_hash',  // bcrypt hash of master password
  LEGACY: 'passwords',            // previous plaintext JSON key
};

/** Crypto parameters */
const CRYPTO_CFG = {
  version: 2,                  // bump when encryption format changes
  algo: 'AES-CBC',
  kdf: 'PBKDF2',
  iterations: 200_000,         // ~200k PBKDF2 iterations
  keyBits: 256,                // AES-256
  ivBytes: 16,                 // 128-bit IV for CBC
  saltBytes: 16,               // 128-bit salt
};

/** Auto-lock (ms) */
const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes

/** ---------------------- Utility Components ---------------------- */
const Modal = ({ open, onClose, children, title }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[min(96vw,640px)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

/** Password strength helper (lightweight, no external deps) */
const estimateStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  // clamp 0..5 for UI
  score = Math.min(score, 5);
  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong', 'Excellent'];
  const widths = ['w-1/6','w-2/6','w-3/6','w-4/6','w-5/6','w-full'];
  const colors = ['bg-red-500','bg-orange-500','bg-yellow-500','bg-green-500','bg-green-600','bg-blue-600'];
  return { label: labels[score], width: widths[score], color: colors[score] };
};

/** Reusable crypto-strong password generator */
const generatePassword = ({ length, upper, lower, numbers, symbols }) => {
  let charset = '';
  if (upper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (lower) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (numbers) charset += '0123456789';
  if (symbols) charset += '!@#$%^&*()_+{}[]<>?';
  if (!charset) return '';

  const arr = new Uint32Array(length);
  window.crypto.getRandomValues(arr);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[arr[i] % charset.length];
  }
  return password;
};

/** PasswordGenerator UI */
const PasswordGenerator = ({ options, setOptions, onGenerate }) => {
  const onClick = () => {
    const pwd = generatePassword(options);
    if (!pwd) {
      toast.error('Select at least one option for password generation!', { theme: 'dark' });
      return;
    }
    onGenerate(pwd);
    toast.success('Strong Password Generated!', { theme: 'dark' });
  };

  return (
    <div className="rounded-2xl border border-green-300 bg-white/70 p-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={options.upper} onChange={e=>setOptions(o=>({...o,upper:e.target.checked}))} />
          <span>Uppercase</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={options.lower} onChange={e=>setOptions(o=>({...o,lower:e.target.checked}))} />
          <span>Lowercase</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={options.numbers} onChange={e=>setOptions(o=>({...o,numbers:e.target.checked}))} />
          <span>Numbers</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={options.symbols} onChange={e=>setOptions(o=>({...o,symbols:e.target.checked}))} />
          <span>Symbols</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="min-w-12">Len:</span>
          <input type="range" min={6} max={64} value={options.length} onChange={e=>setOptions(o=>({...o,length:Number(e.target.value)}))} className="w-full"/>
          <span className="w-8 text-center font-medium">{options.length}</span>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        
      </div>
    </div>
  );
};

/** ---------------------- Main Component ---------------------- */
const Manager = () => {
  const eyeIconRef = useRef();
  const passwordRef = useRef();
  const fileInputRef = useRef(null);

  // ====== Security / Auth state ======
  const [hasMaster, setHasMaster] = useState(false);    // whether a hash exists
  const [isUnlocked, setIsUnlocked] = useState(false);  // unlocked state
  const [masterKey, setMasterKey] = useState('');       // kept only in memory (minimize exposure)
  const [setupMaster, setSetupMaster] = useState({ pw: '', confirm: '' });
  const [unlockPw, setUnlockPw] = useState('');

  // ====== App state ======
  const [form, setform] = useState({ site: "", username: "", password: "" });
  const [passwordArray, setPasswordArray] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStrength, setFilterStrength] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [passwordOptions, setPasswordOptions] = useState({
    length: 12, upper: true, lower: true, numbers: true, symbols: true,
  });

  // ====== Edit Modal state ======
  const [editing, setEditing] = useState(null); // {id, site, username, password} | null

  // ====== Helpers: cryptography ======
  const randomWordArray = (nBytes) => {
    const u8 = new Uint8Array(nBytes);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(u8);
    } else {
      // Fallback – should not happen in modern browsers
      for (let i = 0; i < nBytes; i++) u8[i] = Math.floor(Math.random() * 256);
    }
    return CryptoJS.lib.WordArray.create(u8);
  };

  const deriveKey = (password, saltWA) => {
    return CryptoJS.PBKDF2(password, saltWA, {
      keySize: CRYPTO_CFG.keyBits / 32,
      iterations: CRYPTO_CFG.iterations,
      hasher: CryptoJS.algo.SHA256,
    });
  };

  /**
   * Encrypted blob format (version 2)
   */
  const encryptVaultV2 = (dataObj, password) => {
    const salt = randomWordArray(CRYPTO_CFG.saltBytes);
    const iv = randomWordArray(CRYPTO_CFG.ivBytes);
    const key = deriveKey(password, salt);
    const json = JSON.stringify(dataObj);
    const encrypted = CryptoJS.AES.encrypt(json, key, { iv });

    const blob = {
      v: CRYPTO_CFG.version,
      algo: CRYPTO_CFG.algo,
      kdf: CRYPTO_CFG.kdf,
      iter: CRYPTO_CFG.iterations,
      salt: CryptoJS.enc.Base64.stringify(salt),
      iv: CryptoJS.enc.Base64.stringify(iv),
      ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
    };
    return JSON.stringify(blob);
  };

  const tryDecryptVaultV2 = (blobStr, password) => {
    try {
      const blob = JSON.parse(blobStr);
      if (!blob || blob.v !== 2) return null;
      const salt = CryptoJS.enc.Base64.parse(blob.salt);
      const iv = CryptoJS.enc.Base64.parse(blob.iv);
      const key = deriveKey(password, salt);
      const ct = CryptoJS.enc.Base64.parse(blob.ct);
      const decrypted = CryptoJS.AES.decrypt({ ciphertext: ct }, key, { iv });
      const utf8 = decrypted.toString(CryptoJS.enc.Utf8);
      if (!utf8) return null;
      const parsed = JSON.parse(utf8);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  };

  // ====== Legacy (v1) – passphrase AES without PBKDF2 (from previous code) ======
  const tryDecryptVaultV1 = (ciphertext, passphrase) => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, passphrase);
      const utf8 = bytes.toString(CryptoJS.enc.Utf8);
      if (!utf8) return null;
      const parsed = JSON.parse(utf8);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const persistVault = (arr, password) => {
    const encBlob = encryptVaultV2(arr, password);
    localStorage.setItem(LS_KEYS.VAULT, encBlob);
  };

  // ====== Migrate legacy plaintext -> encrypted (if present) ======
  const migrateLegacyIfAny = (password) => {
    const legacy = localStorage.getItem(LS_KEYS.LEGACY);
    if (!legacy) return null;
    try {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        persistVault(parsed, password);
        localStorage.removeItem(LS_KEYS.LEGACY);
        toast.info('Migrated legacy plaintext passwords to encrypted vault');
        return parsed;
      }
    } catch {
      // invalid legacy JSON – drop for safety
    }
    localStorage.removeItem(LS_KEYS.LEGACY);
    return null;
  };

  // ====== First mount: detect master hash presence ======
  useEffect(() => {
    const hash = localStorage.getItem(LS_KEYS.MASTER_HASH);
    setHasMaster(!!hash);
  }, []);

  // ====== Unlock flow ======
  const handleUnlock = (e) => {
    e && e.preventDefault();
    const hash = localStorage.getItem(LS_KEYS.MASTER_HASH);
    if (!hash) {
      toast.error('No master password set. Please create one.');
      setHasMaster(false);
      return;
    }
    const ok = bcrypt.compareSync(unlockPw, hash);
    if (!ok) {
      toast.error('Incorrect Master Password');
      return;
  
    }

    // Try to load encrypted vault
    const enc = localStorage.getItem(LS_KEYS.VAULT);
    let loaded = [];

    if (enc) {
      // Try v2 first
      let dec = tryDecryptVaultV2(enc, unlockPw);
      if (!dec) {
        // Try older v1 format and migrate forward if success
        const decV1 = tryDecryptVaultV1(enc, unlockPw);
        if (decV1) {
          toast.info('Upgrading vault encryption…');
          persistVault(decV1, unlockPw); // re-save in v2 format
          dec = decV1;
        }
      }
      if (!dec) {
        toast.error('Could not decrypt vault (wrong password or corrupted).');
        return;
      }
      loaded = dec;
    } else {
      // If no encrypted vault yet, try migrating legacy
      const migrated = migrateLegacyIfAny(unlockPw);
      loaded = migrated || [];
      persistVault(loaded, unlockPw);
    }

    setMasterKey(unlockPw);
    setPasswordArray(loaded);
    setIsUnlocked(true);
    setUnlockPw('');
    toast.success('Vault Unlocked');
  };

  // ====== Master setup flow (first run) ======
  const handleSetupMaster = (e) => {
    e.preventDefault();
    if (setupMaster.pw.length < 8) {
      toast.error('Master Password must be at least 8 characters.');
      return;
    }
    if (setupMaster.pw !== setupMaster.confirm) {
      toast.error('Passwords do not match.');
      return;
    }

    // Hash & store the master password (bcrypt includes salt)
    const hash = bcrypt.hashSync(setupMaster.pw, 10);
    localStorage.setItem(LS_KEYS.MASTER_HASH, hash);

    // Migrate any legacy data using the new key, or initialize empty
    const migrated = migrateLegacyIfAny(setupMaster.pw) || [];
    persistVault(migrated, setupMaster.pw);

    setHasMaster(true);
    setMasterKey(setupMaster.pw);
    setPasswordArray(migrated);
    setIsUnlocked(true);
    setSetupMaster({ pw: '', confirm: '' });
    toast.success('Master Password set. Vault created.');
  };

  const hardLock = useCallback(() => {
    setIsUnlocked(false);
    setMasterKey('');
    setVisiblePasswords({});
    setEditing(null);
    toast.info('Vault Locked');
  }, []);

  const handleLock = () => {
    hardLock();
  };

  // ====== Auto-lock on inactivity & tab hide ======
  useEffect(() => {
    if (!isUnlocked) return;

    let timer = null;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        hardLock();
      }, AUTO_LOCK_MS);
    };

    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const onVisibility = () => {
      if (document.hidden) hardLock();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onBeforeUnload = () => {
      hardLock();
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [isUnlocked, hardLock]);

  // ====== Utilities ======
  const getPasswordStrength = (password) => estimateStrength(password);

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast('Copied to clipboard!', { theme: 'dark' });
    });
  };

  const handleChange = (e) => {
    setform({ ...form, [e.target.name]: e.target.value });
  };

  const toggleFormPasswordVisibility = () => {
    if (!passwordRef.current) return;
    const input = passwordRef.current;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (eyeIconRef.current) {
      eyeIconRef.current.src = input.type === 'password' ? 'icons/eye.png' : 'icons/delete.png';
    }
  };

  // ====== SAVE / EDIT / DELETE ======
  const savePassword = () => {
    if (!isUnlocked) {
      toast.error('Unlock the vault first.');
      return;
    }
    if (form.site.length > 3 && form.username.length > 3 && form.password.length > 3) {
      const newEntry = { ...form, id: uuidv4(), createdAt: Date.now(), updatedAt: Date.now() };
      const updatedArray = [...passwordArray, newEntry];
      setPasswordArray(updatedArray);
      setform({ site: '', username: '', password: '' });
      persistVault(updatedArray, masterKey);
      toast('Password Saved', { theme: 'dark' });
    } else {
      toast('Error: Password not Saved');
    }
  };

  const deletePassword = (id) => {
    if (!isUnlocked) {
      toast.error('Unlock the vault first.');
      return;
    }
    const c = confirm('Do you really want to delete this password?');
    if (c) {
      const updatedArray = passwordArray.filter((item) => item.id !== id);
      setPasswordArray(updatedArray);
      persistVault(updatedArray, masterKey);
      toast('Password Deleted!', { theme: 'dark' });
    }
  };

  // NEW: Open edit modal instead of removing the item
  const openEdit = (id) => {
    if (!isUnlocked) {
      toast.error('Unlock the vault first.');
      return;
    }
    const toEdit = passwordArray.find((i) => i.id === id);
    if (!toEdit) return;
    setEditing({ ...toEdit });
  };

  const applyEdit = () => {
    if (!editing) return;
    if (editing.site.length < 3 || editing.username.length < 3 || editing.password.length < 3) {
      toast.error('Please fill all fields correctly.');
      return;
    }
    const updatedArray = passwordArray.map((item) =>
      item.id === editing.id ? { ...editing, updatedAt: Date.now() } : item
    );
    setPasswordArray(updatedArray);
    persistVault(updatedArray, masterKey);
    setEditing(null);
    toast.success('Entry updated.');
  };

  // ====== Export / Import ======
  const handleExport = () => {
    if (!isUnlocked) {
      toast.error('Unlock the vault first.');
      return;
    }
    const blobStr = localStorage.getItem(LS_KEYS.VAULT);
    if (!blobStr) {
      toast.error('No vault to export.');
      return;
    }
    const blob = new Blob([blobStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vault.pm.enc.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      // Validate by attempting to decrypt with current masterKey (if unlocked)
      const okV2 = tryDecryptVaultV2(text, masterKey);
      const okV1 = !okV2 ? tryDecryptVaultV1(text, masterKey) : null;
      if (!okV2 && !okV1) {
        toast.error('Import failed: unable to decrypt with current master password.');
        return;
      }
      // Re-persist in v2 format (even if uploaded was v1)
      const data = okV2 || okV1 || [];
      persistVault(data, masterKey);
      setPasswordArray(data);
      toast.success('Vault imported successfully.');
    } catch (err) {
      toast.error('Import failed: invalid file.');
    } finally {
      e.target.value = '';
    }
  };

  // ====== Screens: Setup, Unlock, Main ======
  const SetupScreen = () => (
    <div className="max-w-md mx-auto p-6 bg-white/80 rounded-2xl shadow">
      <h2 className="text-2xl font-bold mb-4 text-center">Create Master Password</h2>
      <p className="text-sm text-gray-600 mb-4">
        This password encrypts your entire vault. <b>Don’t forget it</b>—there’s no recovery!
      </p>
      <form onSubmit={handleSetupMaster} className="flex flex-col gap-3">
        <input
          type="password"
          className="rounded-full border border-green-500 px-4 py-2"
          placeholder="Master Password (min 8 chars)"
          value={setupMaster.pw}
          onChange={(e) => setSetupMaster({ ...setupMaster, pw: e.target.value })}
        />
        <input
          type="password"
          className="rounded-full border border-green-500 px-4 py-2"
          placeholder="Confirm Master Password"
          value={setupMaster.confirm}
          onChange={(e) => setSetupMaster({ ...setupMaster, confirm: e.target.value })}
        />
        <button className="bg-green-600 hover:bg-green-500 text-white rounded-full px-6 py-2 font-semibold">
          Create Vault
        </button>
      </form>
    </div>
  );

  const UnlockScreen = () => (
    <div className="max-w-md mx-auto p-8 
bg-white/10 backdrop-blur-xl rounded-2xl 
shadow-lg border border-white/40 
hover:shadow-[0_0_20px_rgba(255,255,255,0.6)] transition">
      <h2 className="text-3xl font-extrabold mb-6 text-center text-green-600 tracking-wide">
        🔐 Unlock Vault
      </h2>

      <form onSubmit={handleUnlock} className="flex flex-col gap-4">
        <div className="relative">
          <input
            type="password"
            className="w-full rounded-full border border-green-400 px-5 py-3 pl-12 bg-white/50 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800 placeholder-gray-500 shadow-sm"
            placeholder="Enter Master Password"
            value={unlockPw}
            onChange={(e) => setUnlockPw(e.target.value)}
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3v1h-6v-1z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11h14v10H5V11z" />
            </svg>
          </span>
        </div>

        <button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full px-6 py-3 font-semibold shadow-lg transform transition duration-200 hover:scale-105">
          Unlock
        </button>
      </form>

      <p className="text-sm text-gray-700 mt-4 text-center italic">
        💡 Tip: Plaintext passwords will be auto-migrated to secure storage after unlocking.
      </p>
    </div>

  );

  if (!hasMaster) {
    return (
      <>
        <ToastContainer theme="dark" />
        <div className="absolute inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)]" />
        <div className="min-h-screen flex items-center justify-center p-4">
          <SetupScreen />
        </div>
      </>
    );
  }

  if (!isUnlocked) {
    return (
      <>
        <ToastContainer theme="dark" />
        <div className="absolute inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)]" />
        <div className="min-h-screen flex items-center justify-center p-4">
          <UnlockScreen />
        </div>
      </>
    );
  }

  // ====== Main (unlocked) UI ======
  return (
    <>
      <ToastContainer theme="dark" />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImport}
      />

      <div className="absolute inset-0 -z-10 h-full w-full bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)]"></div>
      <div className='p-2 md:p-0 md:mycontainer min-h-89'>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className='text-4xl font-bold py-4'>
              <span className='text-green-500'> &lt;</span>
              Pass
              <span className='text-green-500'>Op/ &gt;</span>
            </h1>
            <p className='text-green-700 text-lg'>Your Own Password Manager</p>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleExport}
              className="bg-green-700 text-white rounded-full px-4 py-2 hover:bg-green-600"
              title="Export Encrypted Vault"
            >
              Export
            </button>
            <button
              onClick={triggerImport}
              className="bg-indigo-700 text-white rounded-full px-4 py-2 hover:bg-indigo-600"
              title="Import Encrypted Vault"
            >
              Import
            </button>
            <button
              onClick={handleLock}
              className="bg-gray-800 text-white rounded-full px-4 py-2 hover:bg-gray-700"
              title="Lock Vault"
            >
              Lock
            </button>
          </div>
        </div>

        {/* Add form */}
        <div className='text-black flex flex-col p-4 gap-6 items-center'>
          <input value={form.site} onChange={handleChange} placeholder="Enter website URL" className='rounded-full border border-green-500 w-full p-4 py-1' type='text' name='site' id='site' />
          <div className='flex flex-col md:flex-row w-full gap-6'>
            <input value={form.username} onChange={handleChange} placeholder="Enter Username" className='rounded-full border border-green-500 w-full p-4 py-1 h-9' type='text' name='username' id='username' />
            <div className="flex flex-col gap-2 w-full">
              <div className="flex w-full gap-3 items-center">
                {/* Password Input */}
                <div className="relative flex-1">
                  <input
                    ref={passwordRef}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter Password"
                    className='rounded-full border border-green-500 w-full p-4 py-1 pr-12'
                    type='password'
                    name='password'
                    id='password'
                  />
                  {/* Eye Icon */}
                  <span className='absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer' onClick={toggleFormPasswordVisibility}>
                    <img ref={eyeIconRef} className="p-1 opacity-80 hover:opacity-100 transition" width={28} src='icons/eye.png' alt='toggle' />
                  </span>
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={() => setform(f => ({...f, password: generatePassword(passwordOptions)}))}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-md transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                    strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 3.75l-.86 2.59a.75.75 0 01-.7.51H7.5l2.13 1.55a.75.75 0 01.27.84l-.86 2.59L12 10.5l2.96 1.28-.86-2.59a.75.75 0 01.27-.84L16.5 6.85h-2.19a.75.75 0 01-.7-.51L12.75 3.75M21 21l-5.5-5.5" />
                  </svg>
                  Generate
                </button>
              </div>

              {/* Generator options (re-usable component) */}
              <PasswordGenerator
                options={passwordOptions}
                setOptions={setPasswordOptions}
                onGenerate={(pwd)=>setform(f=>({...f,password:pwd}))}
              />

              {/* Strength meter */}
              {form.password && (
                <div className="w-full mt-1">
                  <div className="h-2 rounded-full bg-gray-300">
                    <div
                      className={`h-2 rounded-full ${getPasswordStrength(form.password).color} ${getPasswordStrength(form.password).width}`}
                    ></div>
                  </div>
                  <p className="text-sm mt-1 font-medium text-gray-700">
                    Strength: <span className="text-gray-900">{getPasswordStrength(form.password).label}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <button onClick={savePassword} className='flex justify-center items-center gap-2 bg-green-500 hover:bg-green-400 rounded-full px-8 py-2 w-fit border border-green-900'>
            <lord-icon src="https://cdn.lordicon.com/efxgwrkc.json" trigger="hover" />
            Save Password
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 mb-4">
          <input
            type="text"
            placeholder="🔍 Search by site or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-1/3 px-4 py-2 rounded-full border border-green-500 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <select
            value={filterStrength}
            onChange={(e) => setFilterStrength(e.target.value)}
            className="px-3 py-2 rounded-full border border-green-500 bg-gray-900 text-white"
          >
            <option value="">All Strengths</option>
            <option value="Very Weak">Very Weak</option>
            <option value="Weak">Weak</option>
            <option value="Fair">Fair</option>
            <option value="Strong">Strong</option>
            <option value="Very Strong">Very Strong</option>
            <option value="Excellent">Excellent</option>
          </select>
        </div>

        <div className="passwords">
          <h2 className='font-bold text-2xl py-4'>Your Passwords</h2>
          {passwordArray.length === 0 && <div>No Passwords to show</div>}
          {passwordArray.length !== 0 && (
            <div className="hidden md:block overflow-x-auto">
              <table className="table-auto w-full border border-green-500 rounded-lg overflow-hidden shadow-md">
                <thead className="bg-green-700 text-white">
                  <tr>
                    <th className="px-4 py-2 text-left">Site</th>
                    <th className="px-4 py-2 text-left">Username</th>
                    <th className="px-4 py-2 text-left">Password</th>
                    <th className="px-4 py-2 text-left">Strength</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-green-50 text-gray-800">
                  {passwordArray
                    .filter((item) => {
                      const q = searchQuery.toLowerCase();
                      const matchesSearch =
                        item.site.toLowerCase().includes(q) ||
                        item.username.toLowerCase().includes(q);
                      const matchesFilter =
                        !filterStrength ||
                        getPasswordStrength(item.password).label === filterStrength;
                      return matchesSearch && matchesFilter;
                    })
                    .map((item) => (
                      <tr key={item.id} className="border-b border-green-200 hover:bg-green-100 transition">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.site}</span>
                            <button aria-label="Copy site" className="cursor-pointer" onClick={() => copyText(item.site)}>
                              <lord-icon src="https://cdn.lordicon.com/rrbmabsx.json" trigger="hover" style={{ width: 22, height: 22 }} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span>{item.username}</span>
                            <button aria-label="Copy username" className="cursor-pointer" onClick={() => copyText(item.username)}>
                              <lord-icon src="https://cdn.lordicon.com/rrbmabsx.json" trigger="hover" style={{ width: 22, height: 22 }} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{visiblePasswords[item.id] ? item.password : '••••••••'}</span>
                            <button aria-label="Toggle password visibility" className="cursor-pointer" onClick={() => togglePasswordVisibility(item.id)}>
                              <img
                                src={visiblePasswords[item.id] ? 'icons/delete.png' : 'icons/eye.png'}
                                alt="toggle visibility"
                                className="w-6 h-6 opacity-80 hover:opacity-100 transition"
                              />
                            </button>
                            <button aria-label="Copy password" className="cursor-pointer" onClick={() => copyText(item.password)}>
                              <lord-icon src="https://cdn.lordicon.com/rrbmabsx.json" trigger="hover" style={{ width: 22, height: 22 }} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {(() => {
                            const strength = getPasswordStrength(item.password);
                            let color = 'bg-gray-300 text-gray-900';
                            if (strength.label === 'Very Weak' || strength.label === 'Weak') color = 'bg-red-200 text-red-800';
                            if (strength.label === 'Fair') color = 'bg-yellow-200 text-yellow-800';
                            if (strength.label === 'Strong' || strength.label === 'Very Strong') color = 'bg-green-200 text-green-800';
                            if (strength.label === 'Excellent') color = 'bg-blue-200 text-blue-800';
                            return (
                              <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${color}`}>
                                {strength.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-2 flex justify-center gap-4">
                          <button aria-label="Edit" className="cursor-pointer" onClick={() => openEdit(item.id)}>
                            <lord-icon src="https://cdn.lordicon.com/exymduqj.json" trigger="hover" style={{ width: 25, height: 25 }} />
                          </button>
                          <button aria-label="Delete" className="cursor-pointer" onClick={() => deletePassword(item.id)}>
                            <lord-icon src="https://cdn.lordicon.com/oqeixref.json" trigger="hover" style={{ width: 25, height: 25 }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Entry">
        {editing && (
          <div className="flex flex-col gap-4">
            <input
              value={editing.site}
              onChange={(e)=>setEditing(ed=>({...ed, site:e.target.value}))}
              placeholder="Website URL"
              className='rounded-full border border-green-500 w-full px-4 py-2'
              type='text'
            />
            <input
              value={editing.username}
              onChange={(e)=>setEditing(ed=>({...ed, username:e.target.value}))}
              placeholder="Username"
              className='rounded-full border border-green-500 w-64 px-4 py-2'
              type='text'
            />
            <div className="flex flex-col gap-2">
              <input
                value={editing.password}
                onChange={(e)=>setEditing(ed=>({...ed, password:e.target.value}))}
                placeholder="Password"
                className='rounded-full border border-green-500 w-full px-4 py-2'
                type='text'
              />
              {/* Inline generator + strength for edit */}
              <PasswordGenerator
                options={passwordOptions}
                setOptions={setPasswordOptions}
                onGenerate={(pwd)=>setEditing(ed=>({...ed, password:pwd}))}
              />
              {editing.password && (
                <div className="w-full mt-1">
                  <div className="h-2 rounded-full bg-gray-300">
                    <div className={`h-2 rounded-full ${getPasswordStrength(editing.password).color} ${getPasswordStrength(editing.password).width}`}></div>
                  </div>
                  <p className="text-sm mt-1 font-medium text-gray-700">
                    Strength: <span className="text-gray-900">{getPasswordStrength(editing.password).label}</span>
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={()=>setEditing(null)} className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200">Cancel</button>
              <button onClick={applyEdit} className="px-4 py-2 rounded-full bg-green-600 hover:bg-green-500 text-white">Save</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default Manager;
