import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════
// DATABASE SETUP
// ═══════════════════════════════════════
const db = new Database('digilocker.db');
db.pragma('journal_mode = WAL');

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aadhaar_hash TEXT UNIQUE,
        name TEXT,
        wallet_address TEXT,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cert_hash TEXT UNIQUE,
        student_name TEXT,
        student_wallet TEXT,
        aadhaar_hash TEXT,
        course_title TEXT,
        issuer_name TEXT,
        issuer_wallet TEXT,
        filename TEXT,
        ipfs_cid TEXT,
        tx_hash TEXT,
        block_number INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'ISSUED'
    )
`).run();

// Lightweight migrations for legacy DBs
try {
    const columns = db.prepare(`PRAGMA table_info(certificates)`).all();

    const hasCertHash = columns.some(col => col.name === 'cert_hash');
    if (!hasCertHash) {
        db.prepare(`ALTER TABLE certificates ADD COLUMN cert_hash TEXT`).run();
        console.log("✔ Migrated certificates table: added cert_hash column");
    }

    const hasAadhaarHash = columns.some(col => col.name === 'aadhaar_hash');
    if (!hasAadhaarHash) {
        db.prepare(`ALTER TABLE certificates ADD COLUMN aadhaar_hash TEXT`).run();
        console.log("✔ Migrated certificates table: added aadhaar_hash column");
    }

    const hasIpfsCid = columns.some(col => col.name === 'ipfs_cid');
    if (!hasIpfsCid) {
        db.prepare(`ALTER TABLE certificates ADD COLUMN ipfs_cid TEXT`).run();
        console.log("✔ Migrated certificates table: added ipfs_cid column");
    }
} catch (e) {
    console.error("Certificate table migration check failed:", e.message);
}

db.prepare(`
    CREATE TABLE IF NOT EXISTS universities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        website TEXT,
        wallet_address TEXT UNIQUE,
        added_on DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'VERIFIED'
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS institution_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        wallet_address TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'PENDING'
    )
`).run();

db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT,
        details TEXT,
        performed_by TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// Seed Users
const userCount = db.prepare('SELECT count(*) as count FROM users').get();
if (userCount.count === 0) {
    const ins = db.prepare('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)');
    ins.run('admin@demo.com', 'password', 'admin', 'MeitY Admin');
    ins.run('issuer@demo.com', 'password', 'institution', 'Mumbai University');
    ins.run('student@demo.com', 'password', 'student', 'Rahul Sharma');
    ins.run('verifier@demo.com', 'password', 'verifier', 'TCS Recruitment');
    console.log("✔ Seeded 4 default users");
}

// Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ═══════════════════════════════════════
// CHAIN (Hardhat Localhost) - Demo signer
// ═══════════════════════════════════════
const HARDHAT_RPC = process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545';
// Hardhat default Account #1 private key (publicly known test key)
const DEMO_INSTITUTION_PK =
    process.env.INSTITUTION_PRIVATE_KEY ||
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const getRegistryContract = async () => {
    const provider = new ethers.JsonRpcProvider(HARDHAT_RPC);

    // Read deployed address from frontend file written by scripts/deploy.js
    const addrPath = path.join(process.cwd(), '..', 'frontend', 'src', 'contract-address.json');
    const addrJson = JSON.parse(fs.readFileSync(addrPath, 'utf8'));
    const contractAddress = addrJson.address;

    // Load ABI from frontend artifacts (kept in sync by hardhat config)
    const abiPath = path.join(
        process.cwd(),
        '..',
        'frontend',
        'src',
        'artifacts',
        'contracts',
        'CertificateRegistry.sol',
        'CertificateRegistry.json'
    );
    const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const abi = abiJson.abi;

    const signer = new ethers.Wallet(DEMO_INSTITUTION_PK, provider); // Account #1 by default
    return { registry: new ethers.Contract(contractAddress, abi, signer), signer };
};

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password);
    if (user) {
        res.json({ success: true, user: { email: user.email, role: user.role, name: user.name } });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Student login via Aadhaar number (no password)
app.post('/login-aadhaar', (req, res) => {
    const { aadhaarNumber } = req.body;
    if (!aadhaarNumber) {
        return res.status(400).json({ success: false, message: 'Aadhaar number required' });
    }

    try {
        const aadhaarHash = '0x' + crypto.createHash('sha256').update(aadhaarNumber).digest('hex');
        const student = db.prepare('SELECT * FROM students WHERE aadhaar_hash = ?').get(aadhaarHash);

        // If student already registered, use their name and wallet
        if (student) {
            return res.json({
                success: true,
                user: {
                    name: student.name,
                    role: 'student',
                    aadhaar: aadhaarNumber,
                    walletAddress: student.wallet_address
                }
            });
        }

        // Demo mode: allow login even before registration, so they can register inside Student Portal
        return res.json({
            success: true,
            user: {
                name: 'Student',
                role: 'student',
                aadhaar: aadhaarNumber,
                walletAddress: null
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Wallet-based login for verified institutions
app.post('/login-wallet', (req, res) => {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ success: false, message: 'Wallet address required' });

    try {
        const normalizedWallet = walletAddress.toLowerCase();
        // Check universities table (approved institutions)
        const uni = db.prepare('SELECT * FROM universities WHERE LOWER(wallet_address) = ? AND status = ?').get(normalizedWallet, 'VERIFIED');
        if (uni) {
            return res.json({ success: true, user: { name: uni.name, role: 'institution', walletAddress: uni.wallet_address } });
        }

        // Also check approved institution_requests
        const approved = db.prepare("SELECT * FROM institution_requests WHERE LOWER(wallet_address) = ? AND status = 'APPROVED'").get(normalizedWallet);
        if (approved) {
            return res.json({ success: true, user: { name: approved.name, role: 'institution', walletAddress: approved.wallet_address } });
        }

        res.status(401).json({ success: false, message: 'Wallet not authorized. Request approval from admin first.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ═══════════════════════════════════════
// STUDENT REGISTRATION (Aadhaar + Wallet)
// ═══════════════════════════════════════
app.post('/register-student', (req, res) => {
    const { aadhaarNumber, name, walletAddress } = req.body;
    try {
        // Hash Aadhaar — never store raw
        const aadhaarHash = '0x' + crypto.createHash('sha256').update(aadhaarNumber).digest('hex');

        // Check if already registered
        const existing = db.prepare('SELECT * FROM students WHERE aadhaar_hash = ?').get(aadhaarHash);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Aadhaar already registered' });
        }

        db.prepare('INSERT INTO students (aadhaar_hash, name, wallet_address) VALUES (?, ?, ?)').run(aadhaarHash, name, walletAddress);
        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run(
            'STUDENT_REGISTERED', `Student ${name} registered (wallet: ${walletAddress.substring(0, 10)}...)`, name
        );

        res.json({ success: true, aadhaarHash, name, walletAddress });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Lookup student by Aadhaar
app.post('/lookup-student', (req, res) => {
    const { aadhaarNumber } = req.body;
    const aadhaarHash = '0x' + crypto.createHash('sha256').update(aadhaarNumber).digest('hex');
    const student = db.prepare('SELECT * FROM students WHERE aadhaar_hash = ?').get(aadhaarHash);

    if (student) {
        res.json({ found: true, student: { name: student.name, wallet: student.wallet_address, aadhaarHash } });
    } else {
        res.json({ found: false, aadhaarHash });
    }
});

// Check student registration status by wallet
app.get('/student-status', (req, res) => {
    const { wallet } = req.query;
    const student = db.prepare('SELECT * FROM students WHERE wallet_address = ?').get(wallet);
    if (student) {
        res.json({ registered: true, student: { name: student.name, aadhaarHash: student.aadhaar_hash } });
    } else {
        res.json({ registered: false });
    }
});

// ═══════════════════════════════════════
// INSTITUTION: Issue Certificate
// ═══════════════════════════════════════
app.post('/issue-certificate', upload.single('file'), async (req, res) => {
    try {
        const { studentName, studentWallet, aadhaarHash, courseTitle, issuerName, issuerWallet, txHash, blockNumber } = req.body;
        const fileBuffer = req.file.buffer;
        const certHash = '0x' + crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const fileName = req.file.originalname;

        // Mock IPFS CID
        const ipfsCid = 'Qm' + crypto.randomBytes(22).toString('hex');

        // Check for duplicate
        const existing = db.prepare('SELECT * FROM certificates WHERE cert_hash = ?').get(certHash);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Certificate with this hash already exists' });
        }

        db.prepare(`
            INSERT INTO certificates (cert_hash, student_name, student_wallet, aadhaar_hash, course_title, issuer_name, issuer_wallet, filename, ipfs_cid, tx_hash, block_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(certHash, studentName, studentWallet, aadhaarHash, courseTitle, issuerName, issuerWallet, fileName, ipfsCid, txHash || '', parseInt(blockNumber) || 0);

        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run(
            'CERT_ISSUED', `${courseTitle} issued to ${studentName} by ${issuerName}`, issuerName
        );

        res.json({ success: true, certHash, ipfsCid, fileName });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Institution: Issue Certificate (ON-CHAIN via server demo signer, no MetaMask)
app.post('/issue-certificate-onchain', upload.single('file'), async (req, res) => {
    try {
        const { studentName, studentWallet, aadhaarNumber, courseTitle, issuerName } = req.body;
        if (!studentWallet || !aadhaarNumber || !courseTitle || !studentName) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        if (!req.file?.buffer) {
            return res.status(400).json({ success: false, message: 'File required' });
        }

        // Compute cert hash from file (must match frontend)
        const fileBuffer = req.file.buffer;
        const certHash = '0x' + crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Aadhaar hash (must match contract / frontend)
        const aadhaarHash = '0x' + crypto.createHash('sha256').update(aadhaarNumber).digest('hex');

        const { registry, signer } = await getRegistryContract();

        // Send on-chain tx as demo institution signer (Account #1 by default)
        // Let Hardhat estimate gas/fees; this uses test ETH only.
        const tx = await registry.issueCertificate(
            certHash,
            studentWallet,
            aadhaarHash,
            studentName,
            courseTitle,
            'ipfs://pending'
        );
        const receipt = await tx.wait();

        // Persist in DB (reuse existing logic but with txHash/blockNumber)
        const fileName = req.file.originalname;
        const ipfsCid = 'Qm' + crypto.randomBytes(22).toString('hex');

        const existing = db.prepare('SELECT * FROM certificates WHERE cert_hash = ?').get(certHash);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Certificate with this hash already exists' });
        }

        db.prepare(`
            INSERT INTO certificates (cert_hash, student_name, student_wallet, aadhaar_hash, course_title, issuer_name, issuer_wallet, filename, ipfs_cid, tx_hash, block_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            certHash,
            studentName,
            studentWallet,
            aadhaarHash,
            courseTitle,
            issuerName || 'Institution',
            signer.address,
            fileName,
            ipfsCid,
            tx.hash,
            parseInt(receipt.blockNumber) || 0
        );

        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run(
            'CERT_ISSUED',
            `${courseTitle} issued to ${studentName} by ${issuerName || 'Institution'} (server-signed)`,
            issuerName || 'institution'
        );

        res.json({
            success: true,
            certHash,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            issuerWallet: signer.address
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ═══════════════════════════════════════
// STUDENT: Get My Certificates
// ═══════════════════════════════════════
app.get('/certificates', (req, res) => {
    const { wallet, role, aadhaar } = req.query;

    if (wallet) {
        // Student: get certs by wallet
        const certs = db.prepare("SELECT * FROM certificates WHERE student_wallet = ? AND status = 'ISSUED' ORDER BY timestamp DESC").all(wallet);
        return res.json(certs);
    }

    if (aadhaar) {
        // Student: get certs by Aadhaar hash
        const aadhaarHash = '0x' + crypto.createHash('sha256').update(aadhaar).digest('hex');
        const certs = db.prepare("SELECT * FROM certificates WHERE aadhaar_hash = ? AND status = 'ISSUED' ORDER BY timestamp DESC").all(aadhaarHash);
        return res.json(certs);
    }

    if (role === 'admin' || role === 'verifier') {
        const certs = db.prepare('SELECT * FROM certificates ORDER BY timestamp DESC').all();
        return res.json(certs);
    }

    res.json([]);
});

// Helper for frontend hashing fallback (wallet-less)
app.post('/verify-file', upload.single('file'), (req, res) => {
    try {
        const fileBuffer = req.file.buffer;
        const hash = '0x' + crypto.createHash('sha256').update(fileBuffer).digest('hex');
        res.json({ hash });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ═══════════════════════════════════════
// VERIFIER: Hash Verification
// ═══════════════════════════════════════
app.post('/verify-hash', upload.single('file'), (req, res) => {
    try {
        const fileBuffer = req.file.buffer;
        const computedHash = '0x' + crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const cert = db.prepare('SELECT * FROM certificates WHERE cert_hash = ?').get(computedHash);

        if (cert && cert.status === 'ISSUED') {
            res.json({
                verified: true,
                hash: computedHash,
                certificate: {
                    studentName: cert.student_name,
                    courseTitle: cert.course_title,
                    issuerName: cert.issuer_name,
                    issuerWallet: cert.issuer_wallet,
                    timestamp: cert.timestamp,
                    txHash: cert.tx_hash,
                    blockNumber: cert.block_number
                }
            });
        } else {
            res.json({ verified: false, hash: computedHash });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ verified: false, message: error.message });
    }
});

// Verify by hash string (for QR codes)
app.post('/verify-check', (req, res) => {
    const { hash } = req.body;
    const cert = db.prepare('SELECT * FROM certificates WHERE cert_hash = ?').get(hash);
    if (cert) {
        res.json({ exists: true, cert });
    } else {
        res.json({ exists: false });
    }
});

// ═══════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════
app.get('/admin/stats', (req, res) => {
    const totalCerts = db.prepare('SELECT count(*) as c FROM certificates').get().c;
    const totalStudents = db.prepare('SELECT count(*) as c FROM students').get().c;
    const totalUniversities = db.prepare('SELECT count(*) as c FROM universities').get().c;
    const pendingRequests = db.prepare("SELECT count(*) as c FROM institution_requests WHERE status = 'PENDING'").get().c;
    const recentLogs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 15').all();
    res.json({ totalCerts, totalStudents, totalUniversities, pendingRequests, recentLogs });
});

app.get('/admin/universities', (req, res) => {
    res.json(db.prepare('SELECT * FROM universities ORDER BY added_on DESC').all());
});

// Institution request submission (self-service)
app.post('/institutions/request', (req, res) => {
    const { name, wallet_address } = req.body;
    try {
        db.prepare('INSERT INTO institution_requests (name, wallet_address) VALUES (?, ?)').run(name, wallet_address);
        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run('INSTITUTION_REQUEST', `Request: ${name} (${wallet_address.substring(0, 10)}...)`, name);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Check institution/request status by wallet
app.get('/institutions/status', (req, res) => {
    const { wallet } = req.query;
    try {
        const uni = db.prepare('SELECT * FROM universities WHERE wallet_address = ?').get(wallet);
        if (uni) return res.json({ status: uni.status || 'VERIFIED', type: 'university', uni });

        const reqRow = db.prepare('SELECT * FROM institution_requests WHERE wallet_address = ? ORDER BY submitted_at DESC').get(wallet);
        if (reqRow) return res.json({ status: reqRow.status, type: 'request', request: reqRow });

        res.json({ status: 'NOT_FOUND' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: list institution requests (all)
app.get('/admin/requests', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM institution_requests ORDER BY submitted_at DESC').all();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: approve a request (front-end should call contract.grantIssuerRole first)
app.post('/admin/requests/approve', (req, res) => {
    const { id } = req.body;
    try {
        const row = db.prepare('SELECT * FROM institution_requests WHERE id = ?').get(id);
        if (!row) return res.status(404).json({ success: false, message: 'Request not found' });

        // Mark request approved
        db.prepare("UPDATE institution_requests SET status = 'APPROVED' WHERE id = ?").run(id);

        // Insert into universities table
        db.prepare('INSERT OR IGNORE INTO universities (name, website, wallet_address) VALUES (?, ?, ?)').run(row.name, '', row.wallet_address);
        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run('INSTITUTION_APPROVED', `Approved: ${row.name} (${row.wallet_address.substring(0, 10)}...)`, 'admin');

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin: reject a request
app.post('/admin/requests/reject', (req, res) => {
    const { id } = req.body;
    try {
        const row = db.prepare('SELECT * FROM institution_requests WHERE id = ?').get(id);
        if (!row) return res.status(404).json({ success: false, message: 'Request not found' });

        db.prepare("UPDATE institution_requests SET status = 'REJECTED' WHERE id = ?").run(id);
        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run('INSTITUTION_REJECTED', `Rejected: ${row.name} (${row.wallet_address.substring(0, 10)}...)`, 'admin');

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/admin/universities', (req, res) => {
    const { name, website, wallet_address } = req.body;
    try {
        db.prepare('INSERT INTO universities (name, website, wallet_address) VALUES (?, ?, ?)').run(name, website, wallet_address);
        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run('WHITELIST', `Whitelisted: ${name} (${wallet_address.substring(0, 10)}...)`, 'admin');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/admin/universities/revoke', (req, res) => {
    const { id } = req.body;
    try {
        db.prepare("UPDATE universities SET status = 'REVOKED' WHERE id = ?").run(id);
        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run('REVOKE', `Revoked university ID: ${id}`, 'admin');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/admin/audit-logs', (req, res) => {
    res.json(db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 50').all());
});

// ═══════════════════════════════════════
// START
// ═══════════════════════════════════════
app.listen(PORT, () => {
    console.log(`\n✅ DigiLocker 2.0 Backend running on http://localhost:${PORT}\n`);
});
