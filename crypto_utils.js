import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const PRIVATE_KEY_PATH = path.resolve('private.pem');
const PUBLIC_KEY_PATH = path.resolve('public.pem');

/**
 * Generate RSA Key Pair if not exists
 */
export function generateKeys() {
    if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
        return {
            publicKey: fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'),
            privateKey: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')
        };
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);

    return { publicKey, privateKey };
}

const { publicKey, privateKey } = generateKeys();

/**
 * Encrypt data using Public Key
 */
export function encrypt(text) {
    const buffer = Buffer.from(text);
    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        buffer
    );
    return encrypted.toString('base64');
}

/**
 * Decrypt data using Private Key
 */
export function decrypt(encryptedText) {
    const buffer = Buffer.from(encryptedText, 'base64');
    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        buffer
    );
    return decrypted.toString('utf8');
}

/**
 * Sign data using Private Key (RSA-SHA256)
 */
export function sign(data) {
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'base64');
}

/**
 * Verify data using Public Key
 */
export function verify(data, signature) {
    const verify = crypto.createVerify('SHA256');
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, 'base64');
}
