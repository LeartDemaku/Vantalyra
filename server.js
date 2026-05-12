require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'vantalyra_super_secret_key';
const VERIFICATION_CODE_TTL_MINUTES = Number(process.env.VERIFICATION_CODE_TTL_MINUTES || 10);
const VERIFICATION_CODE_MAX_ATTEMPTS = Number(process.env.VERIFICATION_CODE_MAX_ATTEMPTS || 5);
const EMAIL_SERVICE = process.env.EMAIL_SERVICE;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const mailTransport = (() => {
    if (EMAIL_SERVICE && SMTP_USER && SMTP_PASS) {
        return nodemailer.createTransport({
            service: EMAIL_SERVICE,
            auth: { user: SMTP_USER, pass: SMTP_PASS }
        });
    }

    if (SMTP_HOST && SMTP_PORT && SMTP_FROM) {
        return nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
        });
    }

    return null;
})();


const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Error connecting to database:', err.message);
    else console.log('Connected to the SQLite database.');
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS login_verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            email TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            verification_token TEXT NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            attempts INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    `);
});


app.get('/fshirja-emergjente/:id', (req, res) => {
    const docId = req.params.id;
    console.log(`PO FSHIHET DOKUMENTI ME ID: ${docId}`);
    db.run('DELETE FROM documents WHERE id = ?', [docId], function(err) {
        res.redirect('/dashboard.html');
    });
});


app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));


app.get('/fshij/:id', (req, res) => {
    const docId = req.params.id;
    console.log(`KLIKU U MOR: FSHIRJA E DOKUMENTIT ME ID ${docId}`);
    
    if (db) {
        db.run('DELETE FROM documents WHERE id = ?', [docId], function(err) {
            if (err) console.error('Gabim gjatë fshirjes:', err.message);
            res.redirect('/dashboard.html');
        });
    } else {
        res.status(500).send('Databaza nuk është gati.');
    }
});


function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) return res.status(401).json({ error: 'Mungon tokeni i aksesit.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token jo valid.' });
        req.user = user;
        next();
    });
}

function createVerificationCode() {
    return crypto.randomInt(100000, 1000000).toString();
}

function createVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

function createAccessToken(user) {
    return jwt.sign({ id: user.id, email: user.email, name: user.full_name }, JWT_SECRET, { expiresIn: '24h' });
}

function sendLoginVerificationEmail(email, code) {
    if (!mailTransport) {
        throw new Error('Nodemailer is not configured.');
    }

    return mailTransport.sendMail({
        from: SMTP_FROM,
        to: email,
        subject: 'Kodi i verifikimit per hyrje ne Vantalyra',
        text: `Kodi juaj i verifikimit eshte: ${code}. Ky kod skadon per ${VERIFICATION_CODE_TTL_MINUTES} minuta.`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #111827;">
                <h2>Kodi i verifikimit</h2>
                <p>Per te perfunduar hyrjen ne llogarine tuaj ne Vantalyra, perdorni kodin me poshte:</p>
                <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
                <p>Ky kod skadon per ${VERIFICATION_CODE_TTL_MINUTES} minuta.</p>
                <p>Nese nuk e keni kerkuar ju kete hyrje, injorojeni kete email.</p>
            </div>
        `
    });
}


app.post('/api/register', async (req, res) => {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({ error: 'Ju lutem mbushni të gjitha fushat.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
            [full_name, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(400).json({ error: 'Ky email është regjistruar më parë.' });
                    }
                    return res.status(500).json({ error: 'Gabim gjatë regjistrimit.' });
                }
                res.status(201).json({ message: 'Llogaria u krijua me sukses!' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Gabim sistemi.' });
    }
});


app.post('/api/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ error: 'Ju lutem mbushni te gjitha fushat.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Fjalekalimi i ri duhet te kete te pakten 6 karaktere.' });
    }

    try {
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) return res.status(500).json({ error: 'Gabim sistemi.' });
            if (!user) return res.status(404).json({ error: 'Nuk ekziston llogari me kete email.' });

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            db.run(
                'UPDATE users SET password_hash = ? WHERE email = ?',
                [hashedPassword, email],
                function(updateErr) {
                    if (updateErr) {
                        return res.status(500).json({ error: 'Gabim gjate ndryshimit te fjalekalimit.' });
                    }

                    res.json({ message: 'Fjalekalimi u ndryshua me sukses.' });
                }
            );
        });
    } catch (error) {
        res.status(500).json({ error: 'Gabim sistemi.' });
    }
});


app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Ju lutem mbushni të gjitha fushat.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Gabim sistemi.' });
        if (!user) return res.status(400).json({ error: 'Përdoruesi nuk ekziston.' });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Fjalëkalim i gabuar.' });

        if (!mailTransport) {
            return res.status(500).json({
                error: 'Nodemailer nuk eshte i konfiguruar ende ne server. Vendos EMAIL_SERVICE ose SMTP_HOST bashke me SMTP_USER, SMTP_PASS dhe SMTP_FROM ne .env.'
            });
        }

        const code = createVerificationCode();
        const verificationToken = createVerificationToken();
        const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000).toISOString();

        try {
            const codeHash = await bcrypt.hash(code, 10);

            db.serialize(() => {
                db.run('DELETE FROM login_verification_codes WHERE email = ?', [email]);
                db.run(
                    `INSERT INTO login_verification_codes
                    (user_id, email, code_hash, verification_token, expires_at)
                    VALUES (?, ?, ?, ?, ?)`,
                    [user.id, user.email, codeHash, verificationToken, expiresAt],
                    async (insertErr) => {
                        if (insertErr) {
                            return res.status(500).json({ error: 'Gabim gjate krijimit te kodit te verifikimit.' });
                        }

                        try {
                            await sendLoginVerificationEmail(user.email, code);
                            res.json({
                                requiresVerification: true,
                                verificationToken,
                                email: user.email,
                                message: 'Kodi i verifikimit u dergua ne email.'
                            });
                        } catch (emailError) {
                            db.run('DELETE FROM login_verification_codes WHERE verification_token = ?', [verificationToken]);
                            console.error('Email delivery error:', emailError.message);
                            res.status(500).json({ error: 'Kodi nuk mund te dergohet ne email per momentin.' });
                        }
                    }
                );
            });
        } catch (verificationError) {
            res.status(500).json({ error: 'Gabim sistemi.' });
        }
    });
});

app.post('/api/verify-login-code', (req, res) => {
    const { email, code, verificationToken } = req.body;

    if (!email || !code || !verificationToken) {
        return res.status(400).json({ error: 'Ju lutem plotesoni kodin e verifikimit.' });
    }

    db.get(
        `SELECT lvc.*, u.full_name
         FROM login_verification_codes lvc
         JOIN users u ON u.id = lvc.user_id
         WHERE lvc.email = ? AND lvc.verification_token = ?`,
        [email, verificationToken],
        async (err, record) => {
            if (err) return res.status(500).json({ error: 'Gabim sistemi.' });
            if (!record) return res.status(400).json({ error: 'Seanca e verifikimit nuk u gjet. Provo te kycesh perseri.' });

            if (new Date(record.expires_at).getTime() < Date.now()) {
                db.run('DELETE FROM login_verification_codes WHERE id = ?', [record.id]);
                return res.status(400).json({ error: 'Kodi i verifikimit ka skaduar. Kerkoni nje kod te ri.' });
            }

            if (record.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
                db.run('DELETE FROM login_verification_codes WHERE id = ?', [record.id]);
                return res.status(429).json({ error: 'Keni tejkaluar tentativat e lejuara. Kyçuni perseri per nje kod te ri.' });
            }

            const validCode = await bcrypt.compare(code, record.code_hash);

            if (!validCode) {
                db.run('UPDATE login_verification_codes SET attempts = attempts + 1 WHERE id = ?', [record.id]);
                return res.status(400).json({ error: 'Kodi i verifikimit eshte i pasakte.' });
            }

            db.run('DELETE FROM login_verification_codes WHERE id = ?', [record.id], (deleteErr) => {
                if (deleteErr) return res.status(500).json({ error: 'Gabim sistemi.' });

                const token = createAccessToken({
                    id: record.user_id,
                    email: record.email,
                    full_name: record.full_name
                });

                res.json({
                    token,
                    name: record.full_name,
                    message: 'Verifikimi u krye me sukses.'
                });
            });
        }
    );
});


app.get('/api/documents', authenticateToken, (req, res) => {
    db.all('SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Gabim gjatë marrjes së dokumenteve.' });
        res.json(rows);
    });
});

app.post('/api/documents', authenticateToken, (req, res) => {
    const { filename, format, resource_type, url } = req.body;

    if (!filename || !url) {
        return res.status(400).json({ error: 'Të dhëna të paplota të dokumentit.' });
    }

    db.run(
        'INSERT INTO documents (user_id, filename, format, resource_type, url) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, filename, format || 'unknown', resource_type || 'auto', url],
        function(err) {
            if (err) return res.status(500).json({ error: 'Gabim gjatë ruajtjes së dokumentit.' });
            
            db.get('SELECT * FROM documents WHERE id = ?', [this.lastID], (err, doc) => {
                if (err) return res.status(500).json({ error: 'Dokumenti u ruajt por nuk mund të kthehej.' });
                res.status(201).json(doc);
            });
        }
    );
});


app.delete('/api/documents/:id', authenticateToken, (req, res) => {
    const docId = req.params.id;
    db.run('DELETE FROM documents WHERE id = ? AND user_id = ?', [docId, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Gabim gjatë fshirjes së dokumentit.' });
        if (this.changes === 0) return res.status(404).json({ error: 'Dokumenti nuk u gjet ose nuk keni autorizim.' });
        res.json({ message: 'Dokumenti u fshi me sukses.' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Email transport ready: ${mailTransport ? 'yes' : 'no'}`);
});
