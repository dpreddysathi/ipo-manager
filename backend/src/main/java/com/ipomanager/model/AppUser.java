package com.ipomanager.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A login account. Every Person / IPO / Transaction / Application row
 * belongs to exactly one user via its {@code ownerId} column, so each
 * user only ever sees their own data.
 *
 * <p>Table is {@code app_user} because {@code user} is a reserved word
 * in H2 / Postgres.
 */
@Entity
@Table(name = "app_user")
@Getter
@Setter
@NoArgsConstructor
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "name is required")
    private String name;

    /** Login email — stored lowercase, unique. */
    @Column(nullable = false, unique = true)
    private String email;

    /** BCrypt hash — the raw password is never stored. */
    @Column(nullable = false)
    private String passwordHash;

    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
