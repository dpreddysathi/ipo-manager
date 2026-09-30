package com.ipomanager.service;

import com.ipomanager.dto.KycRequest;
import com.ipomanager.dto.KycResponse;
import com.ipomanager.exception.ResourceNotFoundException;
import com.ipomanager.model.Person;
import com.ipomanager.model.PersonKyc;
import com.ipomanager.repository.PersonKycRepository;
import com.ipomanager.repository.PersonRepository;
import com.ipomanager.security.AuthContext;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * KYC read/write with masking. Masked by default:
 * PAN {@code ABCDE1234F} → {@code ABCDE••••F},
 * email {@code pavan512002@gmail.com} → {@code p•••@gmail.com}.
 * Passwords / MPIN are never returned unless explicitly revealed.
 *
 * <p>Every reveal writes a one-line audit entry (who/what/when — never the
 * values themselves), per spec §7.
 */
@Service
@RequiredArgsConstructor
public class KycService {

    private static final Logger log = LoggerFactory.getLogger(KycService.class);

    private final PersonRepository personRepository;
    private final PersonKycRepository kycRepository;

    @Transactional(readOnly = true)
    public KycResponse getKyc(Long personId, boolean reveal) {
        Person person = personRepository
                .findByIdAndOwnerId(personId, AuthContext.currentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Person", personId));
        PersonKyc kyc = kycRepository.findByPersonId(person.getId())
                .orElseThrow(() -> new ResourceNotFoundException("KYC for person", personId));
        if (reveal) {
            // Audit line: who/what/when only — never log the values.
            log.info("KYC reveal accessed: personId={} fields=[panNumber,email,accountLoginId,accountPassword,mpin] at {}",
                    personId, LocalDateTime.now());
            return revealed(kyc);
        }
        return masked(kyc);
    }

    @Transactional
    public KycResponse upsert(Long personId, KycRequest req) {
        Person person = personRepository
                .findByIdAndOwnerId(personId, AuthContext.currentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Person", personId));
        PersonKyc kyc = kycRepository.findByPersonId(person.getId())
                .orElseGet(() -> {
                    PersonKyc created = new PersonKyc();
                    created.setPerson(person);
                    return created;
                });
        // Only non-null fields overwrite — secrets are never wiped by accident.
        if (req.getPanNumber() != null) {
            kyc.setPanNumber(req.getPanNumber());
        }
        if (req.getEmail() != null) {
            kyc.setEmail(req.getEmail());
        }
        if (req.getDematBroker() != null) {
            kyc.setDematBroker(req.getDematBroker());
        }
        if (req.getAccountLoginId() != null) {
            kyc.setAccountLoginId(req.getAccountLoginId());
        }
        if (req.getAccountPassword() != null) {
            kyc.setAccountPassword(req.getAccountPassword());
        }
        if (req.getMpin() != null) {
            kyc.setMpin(req.getMpin());
        }
        return masked(kycRepository.save(kyc));
    }

    private KycResponse masked(PersonKyc kyc) {
        return new KycResponse(
                kyc.getId(),
                kyc.getPerson().getId(),
                maskPan(kyc.getPanNumber()),
                maskEmail(kyc.getEmail()),
                kyc.getDematBroker(),
                maskLoginId(kyc.getAccountLoginId()),
                kyc.getAccountPassword() != null ? "••••••" : null,
                kyc.getMpin() != null ? "••••••" : null,
                kyc.getUpdatedAt(),
                false);
    }

    private KycResponse revealed(PersonKyc kyc) {
        return new KycResponse(
                kyc.getId(),
                kyc.getPerson().getId(),
                kyc.getPanNumber(),
                kyc.getEmail(),
                kyc.getDematBroker(),
                kyc.getAccountLoginId(),
                kyc.getAccountPassword(),
                kyc.getMpin(),
                kyc.getUpdatedAt(),
                true);
    }

    static String maskPan(String pan) {
        if (pan == null) {
            return null;
        }
        if (pan.length() > 6) {
            return pan.substring(0, 5) + "••••" + pan.charAt(pan.length() - 1);
        }
        if (pan.length() > 1) {
            return "••••" + pan.charAt(pan.length() - 1);
        }
        return "••••";
    }

    static String maskEmail(String email) {
        if (email == null) {
            return null;
        }
        int at = email.indexOf('@');
        if (at <= 0) {
            return "•••";
        }
        return email.charAt(0) + "•••" + email.substring(at);
    }

    static String maskLoginId(String loginId) {
        if (loginId == null) {
            return null;
        }
        if (loginId.length() > 4) {
            return loginId.substring(0, 2) + "•••" + loginId.substring(loginId.length() - 2);
        }
        return "•••";
    }
}
