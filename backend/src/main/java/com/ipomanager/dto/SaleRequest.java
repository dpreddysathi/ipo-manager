package com.ipomanager.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Records the sale of allotted shares: the realized profit (positive) or
 * loss (negative), and when the sale happened (defaults to now).
 */
@Getter
@Setter
@NoArgsConstructor
public class SaleRequest {

    private BigDecimal profitLoss;

    private LocalDateTime soldAt;
}
