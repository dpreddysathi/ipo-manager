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
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "person_id")
    private Person person;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "ipo_id")
    private Ipo ipo;

    @NotNull(message = "amount is required")
    @Positive(message = "amount must be positive")
    @Column(precision = 19, scale = 2)
    private BigDecimal amount;

    @NotNull(message = "direction is required")
    @Enumerated(EnumType.STRING)
    private TxnDirection direction;

    @NotNull(message = "mode is required")
    @Enumerated(EnumType.STRING)
    private TxnMode mode;

    /** Date and time of the transaction (auto-filled with "now", editable). */
    private LocalDateTime txnDate;

    @Column(length = 1000)
    private String remarks;

    /**
     * Who the money came from — the source account / person. For RECEIVED
     * this defaults to the person's name; for SENT it is one of your own
     * accounts (e.g. "HDFC ****1234"). Displayed as "sender → receiver"
     * in the money views.
     */
    @Column(length = 120)
    private String sender;

    /**
     * Who the money went to — the destination account / person. For SENT
     * this defaults to the person's name; for RECEIVED it is one of your own
     * accounts (e.g. "HDFC pool"). Displayed as "sender → receiver".
     */
    @Column(length = 120)
    private String receiver;

    /**
     * Lifecycle of the money: sent/applied → unallocated/allocated →
     * settled (refund after non-allocation, or sold after allocation).
     * Defaults to {@code SENT}.
     */
    @NotNull(message = "status is required")
    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    private TxnStatus status = TxnStatus.SENT;

    /**
     * Realized profit (+) or loss (−) versus the sent amount, recorded on
     * the transaction when it is settled after the allotted shares are sold.
     * Null for every other status.
     */
    @Column(precision = 19, scale = 2)
    private BigDecimal profitLoss;

    /** Settlement workflow: true once the money has been sent back / resolved. */
    private boolean settled = false;

    private LocalDateTime settledAt;

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
     * with {@code status}, so existing queries and the unsettled-only
     * report filter keep working.
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
