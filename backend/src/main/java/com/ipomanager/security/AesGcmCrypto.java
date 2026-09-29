package com.ipomanager.security;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

/**
 * AES-256-GCM helper for KYC field encryption at rest.
 *
 * <p>Initialized once at startup from the {@code KYC_ENCRYPTION_KEY}
 * environment variable (base64 of 32 random bytes) — see
 * {@code com.ipomanager.config.EncryptionKeyConfig}. Wire format is
 * {@code Base64( IV(12 bytes) || ciphertext )}; a fresh random IV is
 * generated per encryption.
 *
 * <p>Plaintext values are never logged anywhere in this class.
 */
public final class AesGcmCrypto {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int IV_LENGTH_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    private static final SecureRandom RANDOM = new SecureRandom();

    private static volatile SecretKey key;

    private AesGcmCrypto() {
    }

    public static synchronized void init(byte[] keyBytes) {
        if (keyBytes == null || keyBytes.length != 32) {
            throw new IllegalArgumentException(
                    "KYC encryption key must be exactly 32 bytes (256 bits)");
        }
        key = new SecretKeySpec(Arrays.copyOf(keyBytes, keyBytes.length), "AES");
    }

    public static boolean isInitialized() {
        return key != null;
    }

    public static String encrypt(String plaintext) {
        SecretKey k = requireKey();
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, k, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[IV_LENGTH_BYTES + ciphertext.length];
            System.arraycopy(iv, 0, out, 0, IV_LENGTH_BYTES);
            System.arraycopy(ciphertext, 0, out, IV_LENGTH_BYTES, ciphertext.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("KYC field encryption failed", e);
        }
    }

    public static String decrypt(String encoded) {
        SecretKey k = requireKey();
        try {
            byte[] in = Base64.getDecoder().decode(encoded);
            if (in.length < IV_LENGTH_BYTES + 1) {
                throw new IllegalStateException("Invalid encrypted KYC payload");
            }
            byte[] iv = Arrays.copyOfRange(in, 0, IV_LENGTH_BYTES);
            byte[] ciphertext = Arrays.copyOfRange(in, IV_LENGTH_BYTES, in.length);
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("KYC field decryption failed", e);
        }
    }

    private static SecretKey requireKey() {
        SecretKey k = key;
        if (k == null) {
            throw new IllegalStateException(
                    "KYC encryption key is not initialized — the application must set "
                            + "KYC_ENCRYPTION_KEY before starting");
        }
        return k;
    }
}
