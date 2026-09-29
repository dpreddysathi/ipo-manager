package com.ipomanager.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * KYC view model. Sensitive fields are masked by default
 * (PAN → {@code ABCDE••••F}, email → {@code p•••@gmail.com}); passwords/MPIN
 * are never returned in masked mode. {@code revealed=true} flips every field
 * to its full decrypted value and writes an audit log line.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class KycResponse {

    private Long id;
    private Long personId;
    private String panNumber;
    private String email;
    private String dematBroker;
    private String accountLoginId;
    private String accountPassword;
    private String mpin;
    private LocalDateTime updatedAt;
    private boolean revealed;
}
