const express = require('express');
const router = express.Router();
const dns = require('dns');
const net = require('net');
const db = require('../db'); // Import the promise-based database connection

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
                // Return the status and code directly instead of rejecting
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
                const fourthLine = lines[3] || ''; // Get the fourth line, or an empty string if it doesn't exist
                console.log('Fourth line:', fourthLine);

                let status, code;
                if (lines[3].includes('250')) {
                    status = 'valid';
                    code = 250;
                } else if (lines[3].includes('553')) {
                    status = 'syntax error';
                    code = 553;
                } else if (lines[3].includes('552')) {
                    status = 'full';
                    code = 552;
                } else if (lines[3].includes('550')) {
                    if (lines[3].includes('inactive')) {
                        status = 'block';
                    } else {
                        status = 'not existed';
                    }
                    code = 550;
                } else {
                    status = 'unknown';
                    code = parseInt(lines[3].split(' ', '-')[0]); // Extract the code from the response
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

router.post('/validate', async (req, res) => {
    const { email, userId } = req.body;
    try {
        const result = await checkEmailExist(email);
        // Save result to database
        await db.query('INSERT INTO single_emails (email, status, code, users_id) VALUES (?, ?, ?, ?)', [email, result.status, result.code, userId]);
        // Return status, code, and fourth line to frontend
        res.json({ status: result.status, code: result.code, fourthLine: result.fourthLine });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
