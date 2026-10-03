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
     * Where this row came from: MANUAL (typed by the user) or AUTO (synced
     * from Chittorgarh's IPO feed). The sync never touches MANUAL rows.
     * Null on rows created before the sync existed means MANUAL.
     */
    private String source;

    /**
     * Hidden from the board (removed by the user, or auto-hidden after the
     * allotment date passes). The row stays in the DB and remains searchable.
     * Null on older rows means visible.
     */
    private Boolean boardHidden;

    /** Basis-of-allotment date when known; the board auto-hides past this. */
    private LocalDate allotmentDate;

    /** Price band low/high as published (e.g. 208 / 220). */
    @Column(precision = 19, scale = 2)
    private BigDecimal priceLow;

    @Column(precision = 19, scale = 2)
    private BigDecimal priceHigh;

    /** Issue size as published, e.g. "178 cr". Display text, not computed. */
    private String issueSize;

    /** Book-running lead manager as published. */
    private String leadManager;

    /** Where it lists, e.g. "BSE, NSE". */
    private String listingExchange;

    /**
     * The user's triage decision for AUTO rows: APPLY (tracking it) or AVOID
     * (not applying — hidden from the board but kept in the DB). Null means
     * undecided: the board shows Apply/Avoid buttons. Manual rows are
     * implicitly APPLY. The sync never changes this; auto-hide only flips
     * boardHidden.
     */
    private String decision;

    /**
     * The login account this row belongs to. Every query is scoped to the
     * current user's id, so users only ever see their own data.
     */
    @Column(name = "owner_id")
    private Long ownerId;
}
