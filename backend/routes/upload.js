const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const archiver = require('archiver');
const path = require('path');
const dns = require('dns');
const net = require('net');
const db = require('../db');

async function checkEmailExist(email) {
    return new Promise((resolve, reject) => {
        const [, domain] = email.split('@');

        dns.resolveMx(domain, (err, mxRecords) => {
            if (err) {
                console.error('Error resolving MX records:', err);
                return resolve({ status: 'syntax error', code: 553, fourthLine: '' });
            }

            if (mxRecords.length === 0) {
                console.error('No MX records found for the domain.');
                return resolve({ status: 'syntax error', code: 553, fourthLine: '' });
            }

            const mxServer = mxRecords[0].exchange;
            console.log('MX server:', mxServer);

            const socket = net.createConnection(25, mxServer);
            let dataBuffer = '';

            socket.on('connect', () => {
                console.log('Connected to MX server');
                socket.write(`HELO example.com\r\n`);
                socket.write(`MAIL FROM:<example@example.com>\r\n`);
                socket.write(`RCPT TO:<${email}>\r\n`);
                socket.write(`QUIT\r\n`);
            });

            socket.on('data', data => {
                dataBuffer += data.toString();
            });

            socket.on('end', () => {
                console.log('Connection closed');
                const lines = dataBuffer.split('\r\n');
                const fourthLine = lines[3] || '';
                console.log('Fourth line:', fourthLine);

                let status, code;
                if (fourthLine.includes('250')) {
                    status = 'valid';
                    code = 250;
                } else if (fourthLine.includes('553')) {
                    status = 'syntax error';
                    code = 553;
                } else if (fourthLine.includes('552')) {
                    status = 'full';
                    code = 552;
                } else if (fourthLine.includes('550')) {
                    if (fourthLine.includes('inactive')) {
                        status = 'block';
                    } else {
                        status = 'not existed';
                    }
                    code = 550;
                } else {
                    status = 'unknown';
                    code = parseInt(fourthLine.split(' ', '-')[0]);
                }
                resolve({ status, code, fourthLine });
            });

            socket.on('error', error => {
                console.error('Error:', error);
                reject(error);
            });
        });
    });
}

async function insertSingleEmail(email, status, code, userId) {
    try {
        const connection = await db.getConnection();
        await connection.execute(
            `INSERT INTO single_emails (email, status, code, users_id) VALUES (?, ?, ?, ?)`,
            [email, status, code, userId]
        );
        connection.release();
    } catch (error) {
        console.error('Database error during insert into single_emails:', error);
    }
}

const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    const userId = req.body.userId;

    try {
        const emails = fs.readFileSync(filePath, 'utf-8').split('\n').map(email => email.trim()).filter(email => email);
        const emailCount = emails.length;
        const validEmails = [];
        const invalidEmails = [];
        const statusCount = {
            "valid": 0,
            "not existed": 0,
            "block": 0,
            "full": 0,
            "syntax error": 0,
            "unknown": 0
        };

        for (const email of emails) {
            const result = await checkEmailExist(email);
            statusCount[result.status]++;
            await insertSingleEmail(email, result.status, result.code, userId);
            if (result.status === 'valid') {
                validEmails.push({ email, status: result.status, code: result.code });
            } else {
                invalidEmails.push({ email, status: result.status, code: result.code });
            }
        }

        const percentages = Object.keys(statusCount).map(status => ((statusCount[status] / emailCount) * 100).toFixed(2));
        const validCsv = validEmails.map(({ email, status, code }) => `${email},${status},${code}`).join('\n');
        const invalidCsv = invalidEmails.map(({ email, status, code }) => `${email},${status},${code}`).join('\n');

        const zipFilePath = path.join(__dirname, '..', 'uploads', 'validation_results.zip');
        const output = fs.createWriteStream(zipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
            try {
                const connection = await db.getConnection();
                await connection.execute(
                    `INSERT INTO list_emails (filename, valid_file, invalid_file, users_id, date, file) VALUES (?, ?, ?, ?, NOW(), ?)`,
                    [
                        originalFileName,
                        Buffer.from(validCsv),
                        Buffer.from(invalidCsv),
                        userId,
                        fs.readFileSync(filePath)
                    ]
                );
                connection.release();
                res.json({
                    emailCount,
                    percentages,
                    zipFilePath: '/api/download/' + path.basename(zipFilePath)
                });
            } catch (dbError) {
                console.error('Database error:', dbError);
                res.status(500).json({ error: 'Database Error' });
            } finally {
                fs.unlinkSync(filePath);
            }
        });

        archive.pipe(output);
        archive.append(validCsv, { name: 'valid.csv' });
        archive.append(invalidCsv, { name: 'invalid.csv' });
        archive.finalize();
    } catch (error) {
        console.error('Error processing the file:', error);
        res.status(500).json({ error: 'Internal Server Error' });
        fs.unlinkSync(filePath);
    }
});

router.get('/download/:filename', (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', filename);
    res.download(filePath, (err) => {
        if (err) {
            console.error('Error downloading file:', err);
            res.status(500).send('Error downloading file');
        } else {
            fs.unlinkSync(filePath);
        }
    });
});

module.exports = router;
