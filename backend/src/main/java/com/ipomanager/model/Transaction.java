package com.ipomanager.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One money movement between two parties for an IPO — always
 * person-to-person (either side may be you, "Me").
 *
 * <p>The receiver owes the sender the amount until money moves back the
 * other way for the same IPO. A return leg (created by
 * {@code POST /api/transactions/{id}/return}) settles the original in a
 * single tap: the original is marked settled and struck off, so it no
 * longer appears under "yet to pay".
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "transactions")
public class Transaction {

    /** Display name used when a leg of the movement is you, not a person. */
    public static final String SELF_NAME = "Me";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Who sent the money. Null means you ("Me") — e.g. you paying a
     * person back.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_person_id")
    private Person senderPerson;

    /**
     * Who received the money. Null means you ("Me") — e.g. a person
     * sending you application money. The receiver owes the sender.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "receiver_person_id")
    private Person receiverPerson;

    /** Denormalized sender display name (person name, or "Me"). */
    @Column(name = "sender_name", length = 120)
    private String senderName;

    /** Denormalized receiver display name (person name, or "Me"). */
    @Column(name = "receiver_name", length = 120)
    private String receiverName;

    /**
     * When this leg is a return (money sent back against an earlier debt
     * leg), it points at the original transaction. Return legs never
     * create debt — they only reduce it. Null for debt legs.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "return_of_id")
    private Transaction returnOf;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ipo_id", nullable = false)
    private Ipo ipo;

    @Column(precision = 19, scale = 2, nullable = false)
    private BigDecimal amount;

    private LocalDateTime txnDate;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private TxnMode mode;

    @Column(length = 1000)
    private String remarks;

    /**
     * Lifecycle of the money: sent/applied → unallocated/allocated →
     * settled (paid back in full after non-allocation, or paid back with
     * profit/loss after the allotted shares were sold).
     * Defaults to {@code SENT}.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 24, nullable = false)
    private TxnStatus status = TxnStatus.SENT;

    /**
     * Realized profit (+) or loss (−) versus the sent amount, recorded on
     * the original transaction when it is settled after the allotted
     * shares are sold. Null for every other status.
     */
    @Column(precision = 19, scale = 2)
    private BigDecimal profitLoss;

    /**
     * True once the money has been returned / resolved. Return legs are
     * created settled; originals become settled when their return is
     * recorded. Settled originals are struck off in every money view.
     */
    private boolean settled = false;

    private LocalDateTime settledAt;

    /**
     * The login account this row belongs to. Every query is scoped to the
     * current user's id, so users only ever see their own data.
     */
    @Column(name = "owner_id")
    private Long ownerId;

    /** True when this leg was sent by you rather than a person. */
    public boolean isSentBySelf() {
        return senderPerson == null;
    }

    /** True when this leg was received by you rather than a person. */
    public boolean isReceivedBySelf() {
        return receiverPerson == null;
    }

    /**
     * Marks the transaction settled with the given settled status,
     * recording the realized profit/loss for a post-sale settlement.
     */
    public void settleAs(TxnStatus settledStatus, BigDecimal profitLoss) {
        if (settledStatus == null || !settledStatus.isSettled()) {
            throw new IllegalArgumentException(
                    "settleAs requires a settled status");
        }
        this.status = settledStatus;
        this.profitLoss = settledStatus == TxnStatus.SETTLED_SOLD
                ? profitLoss : null;
    }

    /**
     * Keeps the legacy {@code settled}/{@code settledAt} columns in sync
     * with {@code status}, so the unsettled-only report filter keeps
     * working.
     */
    @PrePersist
    @PreUpdate
    private void syncSettlement() {
        boolean nowSettled = status != null && status.isSettled();
        if (nowSettled && !settled) {
            settledAt = LocalDateTime.now();
        }
        if (!nowSettled) {
            settledAt = null;
        }
        settled = nowSettled;
    }
}
