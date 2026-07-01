import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const hexKey = process.env.APP_ENCRYPTION_KEY
  if (!hexKey || hexKey.length !== 64) {
    throw new Error(
      'APP_ENCRYPTION_KEY harus berupa hex string 64 karakter (32 bytes). ' +
      'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hexKey, 'hex')
}

/**
 * encrypt — Enkripsi plaintext string dengan AES-256-GCM.
 * Output: "${iv_hex}:${authTag_hex}:${ciphertext_hex}"
 * Diperlukan untuk kolom catatanKonsultasi dan rekomendasiAi (UU PDP No. 27/2022)
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * decrypt — Dekripsi ciphertext yang di-enkripsi dengan encrypt() di atas.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Format ciphertext tidak valid — harus berupa "iv:authTag:ciphertext" (hex dipisah colon)')
  }
  const [ivHex, authTagHex, encryptedHex] = parts
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Format ciphertext tidak valid — salah satu bagian kosong')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
