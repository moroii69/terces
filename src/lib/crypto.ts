import CryptoJS from 'crypto-js';
import type { EncryptedData } from '../types';

export const encrypt = (text: string, passphrase: string): EncryptedData => {
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(text, passphrase, { iv });
  
  return {
    iv: iv.toString(),
    content: encrypted.toString()
  };
};

export const decrypt = (encrypted: EncryptedData, passphrase: string): string => {
  const decrypted = CryptoJS.AES.decrypt(
    encrypted.content,
    passphrase,
    { iv: CryptoJS.enc.Hex.parse(encrypted.iv) }
  );
  
  return decrypted.toString(CryptoJS.enc.Utf8);
};