package com.ipomanager.model;

import com.ipomanager.security.EncryptedStringConverter;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Sensitive per-person data. PAN / email / login id / password / MPIN are
 * encrypted at rest (AES-256-GCM) via {@link EncryptedStringConverter}.
 * Only dematBroker is stored in plaintext.
 *
 * <p>SECURITY NOTE (per spec §2): storing someone else's broker password /
 * MPIN is high-risk — those fields are opt-in and the recommendation is to
 * leave them empty and use a real password manager instead.
 */
@Entity
@Table(name = "person_kyc")
@Getter
@Setter
@NoArgsConstructor
public class PersonKyc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "person_id", unique = true)
    private Person person;

    @Convert(converter = EncryptedStringConverter.class)
    private String panNumber;

    @Convert(converter = EncryptedStringConverter.class)
    private String email;

    /** Plaintext — not sensitive (e.g. "Zerodha", "Groww"). */
    private String dematBroker;

    @Convert(converter = EncryptedStringConverter.class)
    private String accountLoginId;

    /** Opt-in. Recommend leaving unset — see class javadoc. */
    @Convert(converter = EncryptedStringConverter.class)
    private String accountPassword;

    /** Opt-in. Recommend leaving unset — see class javadoc. */
    @Convert(converter = EncryptedStringConverter.class)
    private String mpin;

    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void onSave() {
        updatedAt = LocalDateTime.now();
    }
}
