package com.ipomanager.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;

/**
 * Issues and verifies the JWTs clients send as
 * {@code Authorization: Bearer <token>}.
 *
 * <p>The signing key is derived from the {@code AUTH_JWT_SECRET}
 * environment variable (SHA-256 of whatever value is provided, so any
 * secret works and the HMAC key is always 256 bits). The app refuses to
 * start without it — same fail-fast pattern as the KYC key.
 */
@Service
public class JwtService {

    /** Login sessions last 30 days. */
    private static final long EXPIRY_SECONDS = 30L * 24 * 60 * 60;

    private SecretKey key;

    @PostConstruct
    public void init() {
        String raw = System.getenv("AUTH_JWT_SECRET");
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException(
                    "FATAL: AUTH_JWT_SECRET is not set. Login tokens are signed with "
                            + "HMAC-SHA256 and the app refuses to start without a secret. "
                            + "Generate one with:  openssl rand -hex 32  "
                            + "and pass it as the AUTH_JWT_SECRET environment variable "
                            + "(see DEPLOY.md).");
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(raw.trim().getBytes(StandardCharsets.UTF_8));
            this.key = Keys.hmacShaKeyFor(digest);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "FATAL: could not derive JWT signing key: " + e.getMessage(), e);
        }
    }

    /** Issues a token whose subject is the user's id. */
    public String createToken(Long userId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(EXPIRY_SECONDS)))
                .signWith(key)
                .compact();
    }

    /**
     * Verifies the signature + expiry and returns the user id from the
     * subject. Throws on any problem (bad signature, expired, malformed).
     */
    public Long parseUserId(String token) {
        String subject = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getSubject();
        return Long.valueOf(subject);
    }
}
