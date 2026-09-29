package com.ipomanager.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class TransactionRequest {

    @NotNull(message = "personId is required")
    private Long personId;

    @NotNull(message = "ipoId is required")
    private Long ipoId;

    @NotNull(message = "amount is required")
    @Positive(message = "amount must be positive")
    private BigDecimal amount;

    @NotNull(message = "direction is required")
    private String direction; // RECEIVED | SENT

    @NotNull(message = "mode is required")
    private String mode; // UPI | GPAY | CASH | BANK | SELF

    /** Date and time, ISO like "2026-09-29T10:30". Defaults to now. */
    private LocalDateTime date;

    private String notes;

    /**
     * Who the money came from (free text, e.g. "HDFC ****1234", "Cash").
     * Optional — for RECEIVED it defaults to the person's name.
     */
    private String sender;

    /**
     * Who the money went to (free text, e.g. "HDFC pool").
     * Optional — for SENT it defaults to the person's name.
     */
    private String receiver;

    /**
     * Lifecycle status: SENT | UNALLOCATED | ALLOCATED |
     * SETTLED_UNALLOCATED | SETTLED_SOLD. Optional — defaults to SENT.
     */
    private String status;

    /**
     * Realized profit (+) / loss (−) versus the sent amount. Only
     * meaningful with status SETTLED_SOLD.
     */
    private BigDecimal profitLoss;
}
