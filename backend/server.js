import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import Database from 'better-sqlite3';

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
        pan_hash TEXT,
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

// ═══════════════════════════════════════
// STUDENT REGISTRATION (Aadhaar + PAN + Wallet)
// ═══════════════════════════════════════
app.post('/register-student', (req, res) => {
    const { aadhaarNumber, panNumber, name, walletAddress } = req.body;
    try {
        // Hash Aadhaar and PAN — never store raw
        const aadhaarHash = '0x' + crypto.createHash('sha256').update(aadhaarNumber).digest('hex');
        const panHash = '0x' + crypto.createHash('sha256').update(panNumber).digest('hex');

        // Check if either already registered
        const existingAadhaar = db.prepare('SELECT * FROM students WHERE aadhaar_hash = ?').get(aadhaarHash);
        if (existingAadhaar) {
            return res.status(400).json({ success: false, message: 'Aadhaar already registered' });
        }

        const existingWallet = db.prepare('SELECT * FROM students WHERE wallet_address = ?').get(walletAddress);
        if (existingWallet) {
            return res.status(400).json({ success: false, message: 'Wallet already linked to another account' });
        }

        db.prepare('INSERT INTO students (aadhaar_hash, pan_hash, name, wallet_address) VALUES (?, ?, ?, ?)').run(aadhaarHash, panHash, name, walletAddress);
        db.prepare('INSERT INTO audit_logs (action, details, performed_by) VALUES (?, ?, ?)').run(
            'STUDENT_REGISTERED', `Student ${name} registered with Aadhaar + PAN (wallet: ${walletAddress.substring(0, 10)}...)`, name
        );

        res.json({ success: true, aadhaarHash, panHash, name, walletAddress });
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

// Verify Aadhar and PAN credentials against sandbox
app.post('/verify-credentials', (req, res) => {
    try {
        const { aadhaarNumber, panNumber } = req.body;
        
        // Demo candidates database
        const demoCandidates = [
            { aadhaar: "123456789012", pan: "ABCDE1234F", name: "Rahul Sharma", walletId: "0x1234567890abcdef1234567890abcdef12345678" },
            { aadhaar: "234567890123", pan: "BCDEF2345G", name: "Priya Patel", walletId: "0x2345678901bcdef01234567890abcdef123456ab" },
            { aadhaar: "345678901234", pan: "CDEFG3456H", name: "Amit Kumar Singh", walletId: "0x3456789012cdef012345678901abcdef12345abc" },
            { aadhaar: "456789012345", pan: "DEFGH4567I", name: "Neha Gupta", walletId: "0x456789012def01234567890abcdef123456abcd" },
            { aadhaar: "567890123456", pan: "EFGHI5678J", name: "Rohan Desai", walletId: "0x56789012def01234567890abcdef123456abcde" },
            { aadhaar: "678901234567", pan: "FGHIJ6789K", name: "Anjali Verma", walletId: "0x6789012def01234567890abcdef123456abcdef" },
            { aadhaar: "789012345678", pan: "GHIJK7890L", name: "Vikram Reddy", walletId: "0x789012def01234567890abcdef123456abcdef1" },
            { aadhaar: "890123456789", pan: "HIJKL8901M", name: "Divya Nair", walletId: "0x89012def01234567890abcdef123456abcdef12" },
            { aadhaar: "901234567890", pan: "IJKLM9012N", name: "Arjun Bhat", walletId: "0x9012def01234567890abcdef123456abcdef123" },
            { aadhaar: "012345678901", pan: "JKLMN0123O", name: "Shreya Chopra", walletId: "0xa012def01234567890abcdef123456abcdef1234" }
        ];

        const candidate = demoCandidates.find(
            c => c.aadhaar === aadhaarNumber && c.pan === panNumber
        );

        if (candidate) {
            return res.json({ verified: true, candidate: { name: candidate.name, aadhaar: candidate.aadhaar, pan: candidate.pan, walletId: candidate.walletId } });
        } else {
            return res.json({ verified: false, message: 'Credentials not found in verification database' });
        }
    } catch (error) {
        console.error('Credentials verification error:', error);
        return res.status(500).json({ verified: false, message: 'Server error during verification', error: error.message });
    }
});

// Get all demo candidates for testing
app.get('/demo-candidates', (req, res) => {
    const demoCandidates = [
        { id: 1, name: "Rahul Sharma", aadhaar: "123456789012", pan: "ABCDE1234F", walletId: "0x1234567890abcdef1234567890abcdef12345678" },
        { id: 2, name: "Priya Patel", aadhaar: "234567890123", pan: "BCDEF2345G", walletId: "0x2345678901bcdef01234567890abcdef123456ab" },
        { id: 3, name: "Amit Kumar Singh", aadhaar: "345678901234", pan: "CDEFG3456H", walletId: "0x3456789012cdef012345678901abcdef12345abc" },
        { id: 4, name: "Neha Gupta", aadhaar: "456789012345", pan: "DEFGH4567I", walletId: "0x456789012def01234567890abcdef123456abcd" },
        { id: 5, name: "Rohan Desai", aadhaar: "567890123456", pan: "EFGHI5678J", walletId: "0x56789012def01234567890abcdef123456abcde" },
        { id: 6, name: "Anjali Verma", aadhaar: "678901234567", pan: "FGHIJ6789K", walletId: "0x6789012def01234567890abcdef123456abcdef" },
        { id: 7, name: "Vikram Reddy", aadhaar: "789012345678", pan: "GHIJK7890L", walletId: "0x789012def01234567890abcdef123456abcdef1" },
        { id: 8, name: "Divya Nair", aadhaar: "890123456789", pan: "HIJKL8901M", walletId: "0x89012def01234567890abcdef123456abcdef12" },
        { id: 9, name: "Arjun Bhat", aadhaar: "901234567890", pan: "IJKLM9012N", walletId: "0x9012def01234567890abcdef123456abcdef123" },
        { id: 10, name: "Shreya Chopra", aadhaar: "012345678901", pan: "JKLMN0123O", walletId: "0xa012def01234567890abcdef123456abcdef1234" }
    ];
    res.json(demoCandidates);
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

// ═══════════════════════════════════════
// STUDENT: Get My Certificates
// ═══════════════════════════════════════
app.get('/certificates', (req, res) => {
    const { wallet, role, email } = req.query;

    if (wallet) {
        // Student: get certs by wallet
        const certs = db.prepare("SELECT * FROM certificates WHERE student_wallet = ? AND status = 'ISSUED' ORDER BY timestamp DESC").all(wallet);
        return res.json(certs);
    }

    if (role === 'admin' || role === 'verifier') {
        const certs = db.prepare('SELECT * FROM certificates ORDER BY timestamp DESC').all();
        return res.json(certs);
    }

    res.json([]);
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
    const recentLogs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 15').all();
    res.json({ totalCerts, totalStudents, totalUniversities, recentLogs });
});

app.get('/admin/universities', (req, res) => {
    res.json(db.prepare('SELECT * FROM universities ORDER BY added_on DESC').all());
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
