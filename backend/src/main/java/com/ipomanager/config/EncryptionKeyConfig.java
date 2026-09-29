package com.ipomanager.config;

import com.ipomanager.security.AesGcmCrypto;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;

import java.util.Base64;

/**
 * Fail-fast startup validation of the KYC encryption key.
 *
 * <p>The key MUST come from the {@code KYC_ENCRYPTION_KEY} environment
 * variable (base64 of 32 random bytes). It is deliberately not read from any
 * property file so it can never be committed to source.
 */
@Configuration
public class EncryptionKeyConfig {

    @PostConstruct
    public void initEncryptionKey() {
        String raw = System.getenv("KYC_ENCRYPTION_KEY");
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException(
                    "FATAL: KYC_ENCRYPTION_KEY is not set. This app stores PAN / email / "
                            + "passwords encrypted with AES-256-GCM and refuses to start without a key. "
                            + "Generate one with:  openssl rand -base64 32  "
                            + "and export it as the KYC_ENCRYPTION_KEY environment variable.");
        }
        final byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(raw.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "FATAL: KYC_ENCRYPTION_KEY is not valid base64: " + e.getMessage());
        }
        if (keyBytes.length != 32) {
            throw new IllegalStateException(
                    "FATAL: KYC_ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits); "
                            + "got " + keyBytes.length + " bytes. Generate one with:  openssl rand -base64 32");
        }
        AesGcmCrypto.init(keyBytes);
    }
}
