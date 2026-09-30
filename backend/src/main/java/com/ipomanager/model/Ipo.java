package com.ipomanager.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "ipos")
@Getter
@Setter
@NoArgsConstructor
public class Ipo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "name is required")
    private String name;

    private LocalDate openDate;

    private LocalDate closeDate;

    @Enumerated(EnumType.STRING)
    private IpoStatus status;

    private LocalDate listingDate;

    @Column(precision = 19, scale = 2)
    private BigDecimal price;

    private Integer lotSize;

    @Column(length = 2000)
    private String notes;

    /**
     * Registrar handling this IPO's allotment: KFINTECH, MUFG (Link Intime),
     * BIGSHARE, BSE, or MANUAL. Only KFINTECH and MUFG support automatic
     * PAN checks (their internal endpoints need no captcha); the rest fall
     * back to a guided deep link.
     */
    private String registrar;

    /**
     * The IPO's identifier on the registrar's own site (KFintech clientId,
     * MUFG company_id) — the exact key their allotment lookup expects.
     * Picked from the live registrar list, not typed by hand.
     */
    private String registrarRef;

    /**
     * The login account this row belongs to. Every query is scoped to the
     * current user's id, so users only ever see their own data.
     */
    @Column(name = "owner_id")
    private Long ownerId;
}
