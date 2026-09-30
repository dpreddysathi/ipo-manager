package com.ipomanager.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Body for {@code POST /api/transactions/{id}/return}: records the money
 * moving back to the original sender and settles the original in one tap.
 *
 * <p>Leave {@code profitLoss} empty for a plain return (non-allotted —
 * the exact amount goes back). Set it for an allotted settlement: the
 * return amount becomes {@code original amount + profitLoss}, and the
 * P&L is also noted on the receiver's application for the IPO.
 */
@Getter
@Setter
@NoArgsConstructor
public class ReturnRequest {

    /** Realized profit (+) / loss (−) vs the sent amount. Null = plain return. */
    private BigDecimal profitLoss;
}
