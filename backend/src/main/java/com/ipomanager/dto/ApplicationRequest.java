package com.ipomanager.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class ApplicationRequest {

    @NotNull(message = "personId is required")
    private Long personId;

    @NotNull(message = "ipoId is required")
    private Long ipoId;

    @Min(value = 1, message = "lots must be at least 1")
    private Integer lots;

    private BigDecimal amount;

    /** Optional — when supplied (date only, e.g. 2026-09-28), used as the
     * application's created date (start of day). */
    private LocalDate appliedDate;

    /** Optional on create — defaults to APPLIED. */
    private String status; // APPLIED | ALLOTTED | NOT_ALLOTTED | REFUNDED

    private BigDecimal refundAmount;

    private BigDecimal profitLoss;

    private String remarks;
}
