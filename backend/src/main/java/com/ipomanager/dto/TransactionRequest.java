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

    /**
     * Who sends the money — a person id, or null for you ("Me").
     * At least one of senderId / receiverId must be a real person.
     */
    private Long senderId;

    /** Who receives the money — a person id, or null for you ("Me"). */
    private Long receiverId;

    @NotNull(message = "ipoId is required")
    private Long ipoId;

    @NotNull(message = "amount is required")
    @Positive(message = "amount must be positive")
    private BigDecimal amount;

    @NotNull(message = "mode is required")
    private String mode; // UPI | GPAY | CASH | BANK | SELF

    /** Date and time, ISO like "2026-09-29T10:30". Defaults to now. */
    private LocalDateTime date;

    private String notes;
}
