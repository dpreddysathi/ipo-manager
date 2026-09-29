package com.ipomanager.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Transparent JPA encryption for sensitive KYC string fields
 * (AES-256-GCM via {@link AesGcmCrypto}).
 *
 * <p>Applied explicitly with {@code @Convert} on individual fields —
 * entity code stays unaware of encryption. Plaintext is never logged.
 */
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return attribute == null ? null : AesGcmCrypto.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return dbData == null ? null : AesGcmCrypto.decrypt(dbData);
    }
}
